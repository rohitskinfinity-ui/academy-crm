"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Video,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { MeetingCountdown } from "@/components/admin/meeting-countdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDelete, adminGet, adminPatch, adminPost } from "@/lib/api/admin-client";

type LiveClassItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  platform: "zoom" | "google_meet";
  meeting_url: string | null;
  drive_url: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_label: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  course_id: string | null;
  course_title?: string | null;
  treatment_id: string | null;
  treatment_name?: string | null;
  instructor_name?: string | null;
  created_at: string;
};

type Option = {
  id: string;
  name?: string;
  title?: string;
};

export default function AdminLiveClassesPage() {
  const [items, setItems] = useState<LiveClassItem[]>([]);
  const [courses, setCourses] = useState<Option[]>([]);
  const [treatments, setTreatments] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingZoom, setGeneratingZoom] = useState(false);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    course_id: "",
    treatment_id: "",
    platform: "zoom" as "zoom" | "google_meet",
    meeting_url: "",
    meeting_id: "",
    passcode: "",
    drive_url: "",
    instructor_name: "Senior Faculty Doctor",
    starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    duration_minutes: 60,
    status: "scheduled" as "scheduled" | "live" | "completed" | "cancelled",
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [liveRes, coursesRes, treatmentsRes] = await Promise.all([
        adminGet<{ items: LiveClassItem[] }>("/api/admin/live-classes"),
        adminGet<{ items: Option[] }>("/api/admin/courses", { limit: 100 }),
        adminGet<{ items: Option[] }>("/api/admin/treatments", { limit: 100 }),
      ]);
      setItems(liveRes.data.items ?? []);
      setCourses(coursesRes.data.items ?? []);
      setTreatments(treatmentsRes.data.items ?? []);
    } catch {
      toast.error("Failed to load live class sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function openCreateModal() {
    setEditingId(null);
    setForm({
      title: "",
      description: "",
      course_id: "",
      treatment_id: "",
      platform: "zoom",
      meeting_url: "",
      meeting_id: "",
      passcode: "",
      drive_url: "",
      instructor_name: "Senior Faculty Doctor",
      starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
      duration_minutes: 60,
      status: "scheduled",
    });
    setOpen(true);
  }

  function openEditModal(item: LiveClassItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description || "",
      course_id: item.course_id || "",
      treatment_id: item.treatment_id || "",
      platform: item.platform || "zoom",
      meeting_url: item.meeting_url || "",
      meeting_id: "",
      passcode: "",
      drive_url: item.drive_url || "",
      instructor_name: item.instructor_name || "Senior Faculty Doctor",
      starts_at: new Date(item.starts_at).toISOString().slice(0, 16),
      duration_minutes: 60,
      status: item.status,
    });
    setOpen(true);
  }

  async function autoGenerateZoomMeeting() {
    if (!form.title.trim()) {
      toast.error("Please enter a Session Title first");
      return;
    }
    setGeneratingZoom(true);
    try {
      const res = await adminPost<{
        meeting_url: string;
        meeting_id: string;
        passcode: string;
      }>("/api/admin/live-classes/zoom-generate", {
        topic: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        agenda: form.description || undefined,
      });
      setForm((f) => ({
        ...f,
        platform: "zoom",
        meeting_url: res.data.meeting_url,
        meeting_id: res.data.meeting_id,
        passcode: res.data.passcode,
      }));
      toast.success("Zoom meeting auto-generated via Server-to-Server OAuth!");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to generate Zoom meeting"
          : "Failed to generate Zoom meeting",
      );
    } finally {
      setGeneratingZoom(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        course_id: form.course_id || null,
        treatment_id: form.treatment_id || null,
        platform: form.platform,
        meeting_url: form.meeting_url,
        meeting_id: form.meeting_id || null,
        passcode: form.passcode || null,
        drive_url: form.drive_url || null,
        instructor_name: form.instructor_name,
        starts_at: new Date(form.starts_at).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        status: form.status,
      };

      if (editingId) {
        await adminPatch(`/api/admin/live-classes/${editingId}`, payload);
        toast.success("Live class session updated");
      } else {
        await adminPost("/api/admin/live-classes", payload);
        toast.success("Weekly live class scheduled");
      }
      setOpen(false);
      await loadData();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to save session"
          : "Failed to save session",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Are you sure you want to delete this live class session?")) return;
    try {
      await adminDelete(`/api/admin/live-classes/${id}`);
      toast.success("Session deleted");
      await loadData();
    } catch {
      toast.error("Failed to delete session");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Doctor Connect Classes"
        description="Schedule weekly 1-hour live Zoom & Google Meet sessions with senior faculty doctors to present booklet PPTs and answer clinical questions."
        actions={
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="size-4" />
            Schedule Live Class
          </Button>
        }
      />

      {loading ? (
        <EmptyState message="Loading live class schedule..." />
      ) : items.length === 0 ? (
        <Panel className="p-8 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Video className="size-6" />
          </div>
          <h3 className="font-semibold text-base">No Live Classes Scheduled</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Schedule weekly 1-hour Zoom / Google Meet sessions where doctors connect with students to explain booklet PPTs.
          </p>
          <Button onClick={openCreateModal} size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Schedule First Session
          </Button>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isLive = item.status === "live";
            const isCompleted = item.status === "completed";

            return (
              <Panel
                key={item.id}
                className="p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative overflow-hidden"
              >
                {isLive && (
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg uppercase tracking-wider flex items-center gap-1 animate-pulse">
                    <Radio className="size-3" /> Live Now
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={item.platform === "zoom" ? "default" : "secondary"}
                      className="capitalize text-[11px]"
                    >
                      {item.platform === "zoom" ? "Zoom Meeting" : "Google Meet"}
                    </Badge>

                    <MeetingCountdown startsAt={item.starts_at} />
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-foreground line-clamp-1">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground pt-1 border-t">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-3.5 text-primary" />
                      <span>
                        {new Date(item.starts_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-amber-500" />
                      <span>Duration: {item.duration_label || "60 mins"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <UserCheck className="size-3.5 text-emerald-600" />
                      <span>
                        Faculty: {item.instructor_name || "Senior Doctor"}
                      </span>
                    </div>

                    {item.treatment_name && (
                      <div className="flex items-center gap-2 pt-1">
                        <Sparkles className="size-3.5 text-indigo-500" />
                        <span className="font-medium text-foreground">
                          {item.treatment_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between gap-2">
                  {item.meeting_url ? (
                    <a
                      href={item.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1"
                    >
                      <Button size="sm" className="w-full gap-1.5">
                        <ExternalLink className="size-3.5" />
                        Join Meeting
                      </Button>
                    </a>
                  ) : (
                    <Button size="sm" variant="outline" disabled className="flex-1">
                      No Link
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(item)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void onDelete(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* --- SCHEDULE LIVE CLASS MODAL DIALOG --- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Live Doctor Class" : "Schedule Weekly Live Doctor Class"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Session Title *</Label>
              <Input
                required
                placeholder="e.g. Weekly Doctor Connect — Botox & Facial Injectables"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meeting Platform</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.platform}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      platform: e.target.value as "zoom" | "google_meet",
                    }))
                  }
                >
                  <option value="zoom">Zoom Meeting</option>
                  <option value="google_meet">Google Meet</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Senior Doctor / Faculty Name</Label>
                <Input
                  value={form.instructor_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, instructor_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Meeting Join URL (Zoom / Google Meet) *</Label>
                {form.platform === "zoom" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={generatingZoom}
                    onClick={() => void autoGenerateZoomMeeting()}
                    className="gap-1.5 text-xs text-violet-600 border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-950/40"
                  >
                    {generatingZoom ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-amber-500" />
                    )}
                    {generatingZoom ? "Generating..." : "⚡ Auto-Generate Zoom Link"}
                  </Button>
                )}
              </div>
              <Input
                required
                placeholder="https://us05web.zoom.us/j/... or click Auto-Generate Zoom Link"
                value={form.meeting_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meeting_url: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Meeting ID (Optional)</Label>
                <Input
                  placeholder="854 9912 3041"
                  value={form.meeting_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, meeting_id: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Passcode (Optional)</Label>
                <Input
                  placeholder="123456"
                  value={form.passcode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, passcode: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Google Drive Presentation PPT Link (Optional)</Label>
              <Input
                placeholder="https://docs.google.com/presentation/d/..."
                value={form.drive_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, drive_url: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Link to Course (Optional)</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.course_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, course_id: e.target.value }))
                  }
                >
                  <option value="">-- All Courses / General --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Link to Treatment Module (Optional)</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={form.treatment_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, treatment_id: e.target.value }))
                  }
                >
                  <option value="">-- General Theory Connect --</option>
                  {treatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Scheduled Date & Time *</Label>
                <Input
                  type="datetime-local"
                  required
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, starts_at: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as "scheduled" | "live" | "completed" | "cancelled",
                    }))
                  }
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live Now 🔴</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {saving
                  ? "Saving Session..."
                  : editingId
                  ? "Save Class"
                  : "Schedule Class"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
