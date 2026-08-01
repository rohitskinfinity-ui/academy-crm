"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Film,
  Loader2,
  MonitorPlay,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Video,
} from "lucide-react";
import { AdminCardGridSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { MeetingCountdown } from "@/components/admin/meeting-countdown";
import { GatedJoinButton } from "@/components/admin/gated-join-button";
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
import { toDatetimeLocalValue } from "@/lib/datetime";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";

type LiveClassItem = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  platform: "zoom" | "google_meet";
  meeting_url: string | null;
  host_start_url?: string | null;
  meeting_id?: string | null;
  passcode?: string | null;
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
  recording_status?: string;
  live_class_recording_id?: string | null;
  recording_error?: string | null;
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
  const [startingHostId, setStartingHostId] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Styled Delete Confirmation Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [attendanceTarget, setAttendanceTarget] = useState<LiveClassItem | null>(null);
  const [attendanceUserId, setAttendanceUserId] = useState("");
  const [attendanceList, setAttendanceList] = useState<
    Array<{ user_id: string; full_name: string; email: string }>
  >([]);
  const [enrolledStudents, setEnrolledStudents] = useState<
    Array<{ user_id: string; full_name: string; email: string }>
  >([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [syncingRegistrants, setSyncingRegistrants] = useState(false);
  const [syncingRecordingId, setSyncingRecordingId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState({
    title: "",
    description: "",
    course_id: "",
    treatment_id: "",
    platform: "zoom" as "zoom" | "google_meet",
    meeting_url: "",
    meeting_id: "",
    passcode: "",
    host_start_url: "",
    drive_url: "",
    instructor_name: "Senior Faculty Doctor",
    starts_at: toDatetimeLocalValue(new Date(Date.now() + 86400000)),
    duration_minutes: 60,
    status: "scheduled" as "scheduled" | "live" | "completed" | "cancelled",
  });

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
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
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // While any recording is actively uploading, poll so UI flips to failed/ready
  useEffect(() => {
    const hasProcessing = items.some((i) => i.recording_status === "processing");
    if (!hasProcessing) return;
    const id = window.setInterval(() => {
      void loadData({ silent: true });
    }, 5000);
    return () => window.clearInterval(id);
  }, [items, loadData]);

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
      host_start_url: "",
      drive_url: "",
      instructor_name: "Senior Faculty Doctor",
      starts_at: toDatetimeLocalValue(new Date(Date.now() + 86400000)),
      duration_minutes: 60,
      status: "scheduled",
    });
    setOpen(true);
  }

  function openEditModal(item: LiveClassItem) {
    setEditingId(item.id);
    const fromUrl = parseZoomJoinUrl(item.meeting_url || "");
    setForm({
      title: item.title,
      description: item.description || "",
      course_id: item.course_id || "",
      treatment_id: item.treatment_id || "",
      platform: item.platform || "zoom",
      meeting_url: item.meeting_url || "",
      meeting_id: item.meeting_id || fromUrl.meeting_id,
      passcode: item.passcode || fromUrl.passcode,
      host_start_url: item.host_start_url || "",
      drive_url: item.drive_url || "",
      instructor_name: item.instructor_name || "Senior Faculty Doctor",
      starts_at: toDatetimeLocalValue(item.starts_at),
      duration_minutes: item.duration_label
        ? parseInt(item.duration_label, 10) || 60
        : 60,
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
        start_url?: string;
      }>("/api/admin/live-classes/zoom-generate", {
        topic: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        duration_minutes: Number(form.duration_minutes),
        agenda: form.description || undefined,
      });
      setForm((f) => {
        const fromUrl = parseZoomJoinUrl(res.data.meeting_url);
        return {
          ...f,
          platform: "zoom",
          meeting_url: res.data.meeting_url,
          meeting_id: res.data.meeting_id || fromUrl.meeting_id,
          passcode: res.data.passcode || fromUrl.passcode,
          host_start_url: res.data.start_url || "",
        };
      });
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

  async function startAsHost(item: LiveClassItem) {
    setStartingHostId(item.id);
    try {
      const res = await adminPost<{ start_url: string }>(
        `/api/admin/live-classes/${item.id}/host-start`,
        {},
      );
      const url = res.data.start_url;
      if (!url) throw new Error("No host start URL returned");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to start as host"
          : "Failed to start as host",
      );
    } finally {
      setStartingHostId(null);
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
        host_start_url: form.host_start_url || null,
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

  async function openAttendance(item: LiveClassItem) {
    setAttendanceTarget(item);
    setAttendanceUserId("");
    setLoadingAttendance(true);
    try {
      const [attRes, enrolledRes] = await Promise.all([
        adminGet<{
          items: Array<{ user_id: string; full_name: string; email: string }>;
        }>(`/api/admin/live-classes/${item.id}/attendance`),
        item.course_id
          ? adminGet<{
              items: Array<{
                user_id: string;
                full_name: string;
                email: string;
              }>;
            }>(`/api/admin/live-classes/${item.id}/registrants`)
          : Promise.resolve({ data: { items: [] } }),
      ]);
      setAttendanceList(attRes.data.items ?? []);
      setEnrolledStudents(enrolledRes.data.items ?? []);
    } catch {
      toast.error("Failed to load attendance");
      setEnrolledStudents([]);
    } finally {
      setLoadingAttendance(false);
    }
  }

  async function syncZoomRegistrants() {
    if (!attendanceTarget) return;
    setSyncingRegistrants(true);
    try {
      const res = await adminPost<{
        synced: number;
        total_enrolled: number;
        failed: Array<{ email: string; error: string }>;
      }>(`/api/admin/live-classes/${attendanceTarget.id}/registrants`, {});
      toast.success(
        `Synced ${res.data.synced}/${res.data.total_enrolled} Zoom registrants`,
      );
      if (res.data.failed?.length) {
        toast.message(
          `${res.data.failed.length} failed — meeting may need registration enabled`,
        );
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to sync registrants"
          : "Failed to sync registrants",
      );
    } finally {
      setSyncingRegistrants(false);
    }
  }

  async function syncRecording(item: LiveClassItem) {
    setSyncingRecordingId(item.id);
    try {
      const res = await adminPost<{
        recording: { status: string; error_message?: string | null };
        enqueued: boolean;
        already_ready: boolean;
      }>(`/api/admin/live-classes/${item.id}/recordings`, {});
      if (res.data.already_ready) {
        toast.success("Recording already ready");
      } else if (res.data.enqueued) {
        toast.success(
          "Recording queued — status will update when upload finishes or fails",
        );
      } else if (res.data.recording?.status === "processing") {
        toast.message("Recording upload already in progress");
      } else if (res.data.recording?.error_message) {
        toast.message(res.data.recording.error_message);
      } else {
        toast.message("Recording job is queued — worker will retry shortly");
      }
      await loadData({ silent: true });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to start recording sync"
          : "Failed to start recording sync",
      );
      await loadData({ silent: true });
    } finally {
      setSyncingRecordingId(null);
    }
  }

  async function watchRecording(item: LiveClassItem) {
    try {
      const res = await adminGet<{
        items: Array<{
          status: string;
          signed_video_url?: string | null;
        }>;
      }>(`/api/admin/live-classes/${item.id}/recordings`);
      const ready = (res.data.items ?? []).find(
        (r) => r.status === "ready" && r.signed_video_url,
      );
      if (!ready?.signed_video_url) {
        toast.error("No ready recording yet — try Sync recording");
        return;
      }
      globalThis.open(ready.signed_video_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to open recording"
          : "Failed to open recording",
      );
    }
  }

  async function markUserPresent() {
    if (!attendanceTarget || !attendanceUserId.trim()) return;
    try {
      await adminPost(`/api/admin/live-classes/${attendanceTarget.id}/attendance`, {
        user_id: attendanceUserId.trim(),
      });
      toast.success("Attendance marked");
      await openAttendance(attendanceTarget);
      setAttendanceUserId("");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to mark attendance"
          : "Failed to mark attendance",
      );
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/live-classes/${deleteTarget.id}`);
      toast.success("Live class session deleted");
      setDeleteTarget(null);
      await loadData();
    } catch {
      toast.error("Failed to delete session");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Doctor Connect Classes"
        description="Join unlocks at start time. Students only join if enrolled; Sync Zoom registrants to lock Zoom to that list."
        actions={
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="size-4" />
            Schedule Live Class
          </Button>
        }
      />

      {loading && items.length === 0 ? (
        <AdminCardGridSkeleton reservedOffset={200} />
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

                    <div className="flex flex-col gap-1 pt-1">
                      <div className="flex items-center gap-2">
                        <Film className="size-3.5 text-sky-600 shrink-0" />
                        <span className="capitalize">
                          Recording: {item.recording_status || "pending"}
                        </span>
                      </div>
                      {item.recording_status === "failed" &&
                      item.recording_error ? (
                        <p className="pl-5 text-xs text-destructive leading-snug">
                          {item.recording_error}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
                  <GatedJoinButton
                    eventId={item.id}
                    startsAt={item.starts_at}
                    endsAt={item.ends_at}
                    durationLabel={item.duration_label}
                    meetingUrl={item.meeting_url}
                    status={item.status}
                    className="flex-1 min-w-[7rem]"
                  />

                  {(item.platform === "zoom" || !item.platform) && (
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={
                        startingHostId === item.id ||
                        (!item.meeting_id &&
                          !item.meeting_url &&
                          !item.host_start_url)
                      }
                      onClick={() => void startAsHost(item)}
                    >
                      {startingHostId === item.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <MonitorPlay className="size-3.5" />
                      )}
                      Start as Host
                    </Button>
                  )}

                  {item.recording_status === "ready" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      onClick={() => void watchRecording(item)}
                    >
                      <Film className="size-3.5" />
                      Watch
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={
                        syncingRecordingId === item.id ||
                        item.recording_status === "processing" ||
                        !(item.meeting_id || item.meeting_url)
                      }
                      onClick={() => void syncRecording(item)}
                    >
                      {syncingRecordingId === item.id ||
                      item.recording_status === "processing" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Film className="size-3.5" />
                      )}
                      {syncingRecordingId === item.id
                        ? "Starting…"
                        : item.recording_status === "processing"
                          ? "Uploading…"
                          : item.recording_status === "failed"
                            ? "Retry sync"
                            : "Sync recording"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void openAttendance(item)}
                  >
                    Attendance
                  </Button>
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
                    onClick={() => setDeleteTarget({ id: item.id, title: item.title })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
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
                onChange={(e) => {
                  const meeting_url = e.target.value;
                  const fromUrl = parseZoomJoinUrl(meeting_url);
                  setForm((f) => ({
                    ...f,
                    meeting_url,
                    ...(fromUrl.meeting_id
                      ? { meeting_id: fromUrl.meeting_id }
                      : {}),
                    ...(fromUrl.passcode ? { passcode: fromUrl.passcode } : {}),
                  }));
                }}
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

      {/* --- ATTENDANCE DIALOG --- */}
      <Dialog
        open={!!attendanceTarget}
        onOpenChange={(op) => !op && setAttendanceTarget(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Attendance &amp; enrolled students</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{attendanceTarget?.title}</p>
          <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
            Only enrolled students can join. Use <strong>Join as student</strong>{" "}
            for a personal Zoom link + auto attendance.{" "}
            <strong>Sync Zoom registrants</strong> pre-registers all enrolled
            emails on Zoom (new Auto-Generate meetings have registration on).
          </p>

          {attendanceTarget?.course_id && (
            <Button
              size="sm"
              variant="secondary"
              disabled={syncingRegistrants}
              onClick={() => void syncZoomRegistrants()}
              className="gap-1.5"
            >
              {syncingRegistrants ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Sync Zoom registrants ({enrolledStudents.length} enrolled)
            </Button>
          )}

          <div className="space-y-2">
            <Label>Student user ID (UUID) — manual mark</Label>
            <Input
              placeholder="Paste enrolled student user UUID"
              value={attendanceUserId}
              onChange={(e) => setAttendanceUserId(e.target.value)}
            />
            <Button size="sm" onClick={() => void markUserPresent()}>
              Mark present
            </Button>
          </div>

          <div className="max-h-40 overflow-auto space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Enrolled (can join this class)
            </p>
            {loadingAttendance ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : !attendanceTarget?.course_id ? (
              <p className="text-xs text-muted-foreground">
                Link a course on this live class to gate enrollment.
              </p>
            ) : enrolledStudents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No enrolled students for this course.
              </p>
            ) : (
              enrolledStudents.map((s) => (
                <div
                  key={s.user_id}
                  className="flex items-center justify-between gap-2 text-sm py-1"
                >
                  <span className="truncate">
                    {s.full_name} · {s.email}
                  </span>
                  {attendanceTarget && (
                    <GatedJoinButton
                      eventId={attendanceTarget.id}
                      startsAt={attendanceTarget.starts_at}
                      endsAt={attendanceTarget.ends_at}
                      durationLabel={attendanceTarget.duration_label}
                      meetingUrl={attendanceTarget.meeting_url}
                      status={attendanceTarget.status}
                      userId={s.user_id}
                      label="Join as student"
                    />
                  )}
                </div>
              ))
            )}
          </div>

          <div className="max-h-36 overflow-auto space-y-1 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Marked present
            </p>
            {loadingAttendance ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : attendanceList.length === 0 ? (
              <p className="text-xs text-muted-foreground">No attendance yet.</p>
            ) : (
              attendanceList.map((a) => (
                <div key={a.user_id} className="text-sm">
                  {a.full_name} · {a.email}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* --- STYLED DELETE CONFIRMATION DIALOG MODAL --- */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(op) => !op && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              Delete Live Class Session
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <p className="text-sm text-foreground">
              Are you sure you want to delete{" "}
              <strong className="font-semibold text-foreground">
                "{deleteTarget?.title}"
              </strong>
              ?
            </p>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone. This session will be permanently removed from the course schedule.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting && <Loader2 className="size-4 animate-spin mr-1.5" />}
              {deleting ? "Deleting..." : "Delete Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
