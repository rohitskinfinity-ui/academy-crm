"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from "@/lib/api/admin-client";
import { toDatetimeLocalValue } from "@/lib/datetime";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";

type ProgrammeMeta = {
  live_lectures_per_week?: number;
  hands_on_days_total?: number;
  hands_on_months?: number;
  module_count?: number;
  programme_duration_months?: number;
  min_live_attendance_pct?: number;
  min_hands_on_days_attended?: number;
};

type CourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  list_price: number | null;
  duration_label?: string | null;
  certificate_label?: string | null;
  programme_meta?: ProgrammeMeta;
  eligible_qualifications?: string[];
  treatments: Array<{
    treatment_id: string;
    treatment_name: string;
    sort_order: number;
    hands_on_default: boolean;
    delivery_modes?: Array<"hands_on" | "practical" | "lecture"> | null;
    live_sessions_planned?: number;
  }>;
};

type TreatmentOption = { id: string; name: string; slug: string };

type ScheduleEvent = {
  id: string;
  type: string;
  title: string;
  starts_at: string;
  treatment_name?: string;
  batch_name?: string;
};

type Batch = { id: string; name: string; campus_name?: string };

type ModuleSchedule = {
  treatment_id: string;
  treatment_name: string;
  treatment_slug: string;
  live_sessions_planned: number;
  scheduled_live_count: number;
  remaining: number;
};

export default function AdminCourseDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [allTreatments, setAllTreatments] = useState<TreatmentOption[]>([]);
  const [selected, setSelected] = useState<
    Array<{
      treatment_id: string;
      hands_on_default: boolean;
      live_sessions_planned: number;
      modes: {
        hands_on: boolean;
        practical: boolean;
        lecture: boolean;
      };
    }>
  >([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [moduleBoard, setModuleBoard] = useState<ModuleSchedule[]>([]);
  const [tab, setTab] = useState<"details" | "programme" | "treatments" | "schedule">(
    "details",
  );
  const [eventFilter, setEventFilter] = useState<"all" | "live_class" | "workshop">(
    "all",
  );

  const [meta, setMeta] = useState({
    title: "",
    slug: "",
    description: "",
    status: "draft",
    list_price: "",
    duration_label: "",
    certificate_label: "",
  });

  const [programme, setProgramme] = useState<ProgrammeMeta>({
    live_lectures_per_week: 1,
    hands_on_days_total: 9,
    hands_on_months: 3,
    module_count: 13,
    programme_duration_months: 6,
    min_live_attendance_pct: 75,
    min_hands_on_days_attended: 7,
  });
  const [eligibleText, setEligibleText] = useState("");

  const [scheduleForm, setScheduleForm] = useState({
    batch_id: "",
    treatment_id: "",
    meeting_url: "",
    meeting_id: "",
    passcode: "",
    host_start_url: "",
    instructor_name: "Senior Faculty Doctor",
    starts_at: toDatetimeLocalValue(new Date(Date.now() + 86400000)),
    duration_minutes: 60,
    hands_on_treatment_id: "",
    hands_on_starts_at: toDatetimeLocalValue(new Date(Date.now() + 30 * 86400000)),
    hands_on_duration_hours: 8,
    hands_on_venue: "Skinfinity Academy of Cosmetology",
    gap_days: 7,
    fill_treatment_ids: [] as string[],
  });

  const [savingDetails, setSavingDetails] = useState(false);
  const [savingProgramme, setSavingProgramme] = useState(false);
  const [savingTreatments, setSavingTreatments] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [generatingZoom, setGeneratingZoom] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [showFillAssist, setShowFillAssist] = useState(false);

  const load = useCallback(async () => {
    try {
      const [courseRes, treatmentsRes, scheduleRes] = await Promise.all([
        adminGet<CourseDetail>(`/api/admin/courses/${id}`),
        adminGet<{ items: TreatmentOption[] }>("/api/admin/treatments", {
          limit: 100,
        }),
        adminGet<{
          schedule: ScheduleEvent[];
          batches: Batch[];
          modules: ModuleSchedule[];
        }>(`/api/admin/courses/${id}/schedule`),
      ]);
      setCourse(courseRes.data);
      setAllTreatments(treatmentsRes.data.items ?? []);
      setSchedule(scheduleRes.data.schedule ?? []);
      setBatches(scheduleRes.data.batches ?? []);
      setModuleBoard(scheduleRes.data.modules ?? []);
      setSelected(
        (courseRes.data.treatments ?? []).map((t) => {
          const saved = Array.isArray(t.delivery_modes) ? t.delivery_modes : [];
          const modes = {
            hands_on: saved.includes("hands_on"),
            practical: saved.includes("practical"),
            lecture: saved.includes("lecture"),
          };
          if (!saved.length) {
            modes.hands_on = t.hands_on_default;
            modes.lecture = !t.hands_on_default;
          }
          return {
            treatment_id: t.treatment_id,
            hands_on_default: t.hands_on_default,
            live_sessions_planned: t.live_sessions_planned ?? 1,
            modes,
          };
        }),
      );
      setMeta({
        title: courseRes.data.title,
        slug: courseRes.data.slug,
        description: courseRes.data.description ?? "",
        status: courseRes.data.status,
        list_price: courseRes.data.list_price?.toString() ?? "",
        duration_label: courseRes.data.duration_label ?? "",
        certificate_label: courseRes.data.certificate_label ?? "",
      });
      setProgramme({
        live_lectures_per_week: 1,
        hands_on_days_total: 9,
        hands_on_months: 3,
        module_count: 13,
        programme_duration_months: 6,
        min_live_attendance_pct: 75,
        min_hands_on_days_attended: 7,
        ...(courseRes.data.programme_meta ?? {}),
      });
      setEligibleText((courseRes.data.eligible_qualifications ?? []).join(", "));
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load"
          : "Failed to load",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    try {
      await adminPatch(`/api/admin/courses/${id}`, {
        title: meta.title,
        slug: meta.slug,
        description: meta.description || null,
        status: meta.status,
        list_price: meta.list_price ? Number(meta.list_price) : null,
        duration_label: meta.duration_label || null,
        certificate_label: meta.certificate_label || null,
      });
      toast.success("Course saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveProgramme(e: FormEvent) {
    e.preventDefault();
    setSavingProgramme(true);
    try {
      await adminPatch(`/api/admin/courses/${id}`, {
        programme_meta: programme,
        eligible_qualifications: eligibleText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success("Programme settings saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSavingProgramme(false);
    }
  }

  function toggleTreatment(treatmentId: string) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.treatment_id === treatmentId);
      if (exists) return prev.filter((p) => p.treatment_id !== treatmentId);
      return [
        ...prev,
        {
          treatment_id: treatmentId,
          hands_on_default: true,
          live_sessions_planned: 1,
          modes: { hands_on: true, practical: false, lecture: false },
        },
      ];
    });
  }

  function toggleMode(
    treatmentId: string,
    mode: "hands_on" | "practical" | "lecture",
  ) {
    setSelected((prev) =>
      prev.map((p) => {
        if (p.treatment_id !== treatmentId) return p;
        const modes = { ...p.modes, [mode]: !p.modes[mode] };
        return {
          ...p,
          modes,
          hands_on_default: modes.hands_on || modes.practical,
        };
      }),
    );
  }

  function setLiveSessionsPlanned(treatmentId: string, value: number) {
    setSelected((prev) =>
      prev.map((p) =>
        p.treatment_id === treatmentId
          ? { ...p, live_sessions_planned: Math.max(0, value) }
          : p,
      ),
    );
  }

  async function saveTreatments() {
    setSavingTreatments(true);
    try {
      await adminPut(`/api/admin/courses/${id}/treatments`, {
        treatments: selected.map((t, i) => {
          const delivery_modes = (
            ["hands_on", "practical", "lecture"] as const
          ).filter((m) => t.modes[m]);
          return {
            treatment_id: t.treatment_id,
            sort_order: i,
            hands_on_default: t.modes.hands_on || t.modes.practical,
            delivery_modes:
              delivery_modes.length > 0 ? delivery_modes : ["lecture"],
            live_sessions_planned: t.live_sessions_planned,
          };
        }),
      });
      toast.success("Treatments updated");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    } finally {
      setSavingTreatments(false);
    }
  }

  async function createCohort() {
    setCreatingBatch(true);
    try {
      const startsOn = new Date();
      const endsOn = new Date(startsOn);
      endsOn.setMonth(endsOn.getMonth() + 6);
      const name =
        batchName.trim() ||
        `${meta.title || course?.title || "Course"} Cohort ${startsOn.getFullYear()}`;

      const res = await adminPost<{ id: string; name: string }>(
        "/api/admin/batches",
        {
          course_id: id,
          name,
          starts_on: startsOn.toISOString().slice(0, 10),
          ends_on: endsOn.toISOString().slice(0, 10),
          training_mode: "hybrid",
          seats_total: 20,
          seats_left: 20,
          is_active: true,
        },
      );
      toast.success(`Cohort created: ${res.data.name}`);
      setBatchName("");
      setScheduleForm((f) => ({ ...f, batch_id: res.data.id }));
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to create cohort"
          : "Failed to create cohort",
      );
    } finally {
      setCreatingBatch(false);
    }
  }

  async function generateZoomLink() {
    if (!scheduleForm.treatment_id) {
      toast.error("Select a module first");
      return;
    }
    if (!scheduleForm.starts_at) {
      toast.error("Set date & time first");
      return;
    }
    setGeneratingZoom(true);
    try {
      const mod =
        moduleBoard.find((m) => m.treatment_id === scheduleForm.treatment_id) ??
        allTreatments.find((t) => t.id === scheduleForm.treatment_id);
      const topic =
        (mod && "treatment_name" in mod
          ? mod.treatment_name
          : (mod as TreatmentOption | undefined)?.name) ||
        "Live Lecture";

      const res = await adminPost<{
        meeting_url: string;
        meeting_id: string;
        passcode: string;
        start_url?: string;
      }>("/api/admin/live-classes/zoom-generate", {
        topic: `Live Lecture — ${topic}`,
        starts_at: new Date(scheduleForm.starts_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes) || 60,
        agenda: `Skinfinity Academy live class for ${topic}`,
      });
      setScheduleForm((f) => {
        const fromUrl = parseZoomJoinUrl(res.data.meeting_url);
        return {
          ...f,
          meeting_url: res.data.meeting_url,
          meeting_id: res.data.meeting_id || fromUrl.meeting_id,
          passcode: res.data.passcode || fromUrl.passcode,
          host_start_url: res.data.start_url || "",
        };
      });
      toast.success(
        "Zoom link generated (no join before host · watermark · cloud recording)",
      );
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

  async function addManualLive() {
    if (!scheduleForm.treatment_id) {
      toast.error("Select a module for this live class");
      return;
    }
    if (!scheduleForm.meeting_url.trim()) {
      toast.error("Generate or paste a Zoom / Meet URL");
      return;
    }
    setScheduling(true);
    try {
      await adminPost(`/api/admin/courses/${id}/schedule`, {
        action: "manual_live",
        treatment_id: scheduleForm.treatment_id,
        batch_id: scheduleForm.batch_id || null,
        meeting_url: scheduleForm.meeting_url,
        host_start_url: scheduleForm.host_start_url || null,
        meeting_id: scheduleForm.meeting_id || null,
        passcode: scheduleForm.passcode || null,
        instructor_name: scheduleForm.instructor_name,
        starts_at: new Date(scheduleForm.starts_at).toISOString(),
        duration_minutes: Number(scheduleForm.duration_minutes) || 60,
        platform: "zoom",
      });
      toast.success("Live class scheduled");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Scheduling failed"
          : "Scheduling failed",
      );
    } finally {
      setScheduling(false);
    }
  }

  async function fillRemaining() {
    const ids =
      scheduleForm.fill_treatment_ids.length > 0
        ? scheduleForm.fill_treatment_ids
        : moduleBoard.filter((m) => m.remaining > 0).map((m) => m.treatment_id);
    if (!ids.length) {
      toast.error("No modules with remaining live sessions");
      return;
    }
    setScheduling(true);
    try {
      await adminPost(`/api/admin/courses/${id}/schedule`, {
        action: "fill_remaining",
        treatment_ids: ids,
        batch_id: scheduleForm.batch_id || null,
        starts_at: new Date(scheduleForm.starts_at).toISOString(),
        gap_days: Number(scheduleForm.gap_days) || 7,
        duration_minutes: Number(scheduleForm.duration_minutes) || 60,
        meeting_url: scheduleForm.meeting_url,
        instructor_name: scheduleForm.instructor_name,
        platform: "zoom",
      });
      toast.success("Remaining live sessions created");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Fill remaining failed"
          : "Fill remaining failed",
      );
    } finally {
      setScheduling(false);
    }
  }

  async function deleteScheduleEvent(eventId: string) {
    try {
      await adminDelete(
        `/api/admin/courses/${id}/schedule?event_id=${encodeURIComponent(eventId)}`,
      );
      toast.success("Event removed");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Delete failed"
          : "Delete failed",
      );
    }
  }

  async function addManualHandsOn() {
    if (!scheduleForm.hands_on_treatment_id) {
      toast.error("Select a module for this hands-on day");
      return;
    }
    setScheduling(true);
    try {
      await adminPost(`/api/admin/courses/${id}/schedule`, {
        action: "manual_hands_on",
        treatment_id: scheduleForm.hands_on_treatment_id,
        batch_id: scheduleForm.batch_id || null,
        starts_at: new Date(scheduleForm.hands_on_starts_at).toISOString(),
        duration_hours: Number(scheduleForm.hands_on_duration_hours) || 8,
        venue: scheduleForm.hands_on_venue || null,
      });
      toast.success("Hands-on day scheduled");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Scheduling failed"
          : "Scheduling failed",
      );
    } finally {
      setScheduling(false);
    }
  }

  if (!course) return <EmptyState message="Loading course…" />;

  const filteredEvents =
    eventFilter === "all"
      ? schedule
      : schedule.filter((e) => e.type === eventFilter);

  const tabs = [
    { id: "details" as const, label: "Details" },
    { id: "programme" as const, label: "Programme & Eligibility" },
    { id: "treatments" as const, label: "Modules" },
    { id: "schedule" as const, label: "Schedule" },
  ];

  return (
    <div>
      <Link
        href="/admin/courses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to courses
      </Link>

      <PageHeader
        title={course.title}
        description="Edit course details, modules, live classes, and hands-on campus schedule."
      />

      <div className="mb-6 flex gap-2 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <Panel className="max-w-xl p-5">
          <form onSubmit={saveMeta} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={meta.title}
                onChange={(e) => {
                  const title = e.target.value;
                  setMeta((m) => ({
                    ...m,
                    title,
                    slug: title
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={meta.slug}
                onChange={(e) => setMeta((m) => ({ ...m, slug: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={4}
                value={meta.description}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, description: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
                  value={meta.status}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, status: e.target.value }))
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>List price (INR)</Label>
                <Input
                  type="number"
                  value={meta.list_price}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, list_price: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Duration label</Label>
                <Input
                  placeholder="6 Months"
                  value={meta.duration_label}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, duration_label: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Certificate label</Label>
                <Input
                  placeholder="PGDCC"
                  value={meta.certificate_label}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, certificate_label: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button type="submit" disabled={savingDetails}>
              {savingDetails && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Save details
            </Button>
          </form>
        </Panel>
      )}

      {tab === "programme" && (
        <Panel className="max-w-xl p-5">
          <form onSubmit={saveProgramme} className="space-y-4">
            <h3 className="font-semibold">Programme delivery metadata</h3>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ["live_lectures_per_week", "Live lectures / week"],
                  ["hands_on_days_total", "Hands-on days total"],
                  ["hands_on_months", "Hands-on window (months)"],
                  ["module_count", "Module count"],
                  ["programme_duration_months", "Programme duration (months)"],
                  ["min_live_attendance_pct", "Min live attendance %"],
                  ["min_hands_on_days_attended", "Min hands-on days attended"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    value={programme[key] ?? ""}
                    onChange={(e) =>
                      setProgramme((p) => ({
                        ...p,
                        [key]: Number(e.target.value),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Eligible qualifications (comma-separated)</Label>
              <Textarea
                rows={2}
                placeholder="MBBS, BDS, BAMS, MDS, BHMS, Allied Health Physician"
                value={eligibleText}
                onChange={(e) => setEligibleText(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={savingProgramme}>
              {savingProgramme && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              Save programme settings
            </Button>
          </form>
        </Panel>
      )}

      {tab === "treatments" && (
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Curriculum modules</h3>
              <p className="text-xs text-muted-foreground">
                Set delivery modes and how many live classes each module needs
                (1, 2, or more).
              </p>
            </div>
            <Button
              size="sm"
              disabled={savingTreatments}
              onClick={() => void saveTreatments()}
            >
              {savingTreatments && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              Save modules
            </Button>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-auto">
            {allTreatments.map((t) => {
              const sel = selected.find((s) => s.treatment_id === t.id);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border px-3 py-2.5 space-y-2"
                >
                  <div className="flex items-center justify-between gap-4">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        checked={!!sel}
                        onChange={() => toggleTreatment(t.id)}
                        className="size-4 shrink-0 rounded"
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{t.name}</span>
                        <p className="text-xs text-muted-foreground">{t.slug}</p>
                      </div>
                    </label>
                    {sel && (
                      <div className="flex shrink-0 items-center gap-2 text-xs">
                        <Label className="whitespace-nowrap text-muted-foreground">
                          Live sessions
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-16"
                          value={sel.live_sessions_planned}
                          onChange={(e) =>
                            setLiveSessionsPlanned(
                              t.id,
                              Number(e.target.value) || 0,
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                  {sel && (
                    <div className="ml-7 flex flex-wrap items-center gap-3 text-xs">
                      {(
                        [
                          ["hands_on", "Hands-on"],
                          ["practical", "Practical"],
                          ["lecture", "Lecture only"],
                        ] as const
                      ).map(([mode, label]) => (
                        <label
                          key={mode}
                          className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-muted-foreground hover:text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={sel.modes[mode]}
                            onChange={() => toggleMode(t.id, mode)}
                            className="size-3.5 rounded"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {tab === "schedule" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Panel className="p-5 space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Calendar className="size-4" />
                Module live-class plan
              </h3>
              <p className="text-xs text-muted-foreground">
                Planned counts come from the Modules tab. Add sessions manually
                per module — a treatment may need two or more live classes.
              </p>
              <div className="space-y-2 max-h-56 overflow-auto">
                {moduleBoard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Attach modules first, then return here to schedule.
                  </p>
                ) : (
                  moduleBoard.map((m) => (
                    <div
                      key={m.treatment_id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium line-clamp-1">
                          {m.treatment_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Planned {m.live_sessions_planned} · Scheduled{" "}
                          {m.scheduled_live_count} · Remaining {m.remaining}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setScheduleForm((f) => ({
                            ...f,
                            treatment_id: m.treatment_id,
                          }))
                        }
                      >
                        Add session
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Panel>

            <Panel className="p-5 space-y-4">
              <h3 className="font-semibold">Add live class (manual)</h3>
              <div className="space-y-2">
                <Label>Cohort / batch</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={scheduleForm.batch_id}
                  onChange={(e) =>
                    setScheduleForm((f) => ({ ...f, batch_id: e.target.value }))
                  }
                >
                  <option value="">All cohorts</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.campus_name ? ` · ${b.campus_name}` : ""}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <Input
                    placeholder="New cohort name (optional)"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={creatingBatch}
                    onClick={() => void createCohort()}
                    className="shrink-0"
                  >
                    {creatingBatch && (
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                    )}
                    Create cohort
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Module *</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={scheduleForm.treatment_id}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      treatment_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Select module</option>
                  {(moduleBoard.length
                    ? moduleBoard
                    : selected.map((s) => {
                        const t = allTreatments.find(
                          (x) => x.id === s.treatment_id,
                        );
                        return {
                          treatment_id: s.treatment_id,
                          treatment_name: t?.name ?? s.treatment_id,
                        };
                      })
                  ).map((m) => (
                    <option key={m.treatment_id} value={m.treatment_id}>
                      {m.treatment_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date & time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleForm.starts_at}
                    onChange={(e) =>
                      setScheduleForm((f) => ({
                        ...f,
                        starts_at: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (mins)</Label>
                  <Input
                    type="number"
                    min={15}
                    value={scheduleForm.duration_minutes}
                    onChange={(e) =>
                      setScheduleForm((f) => ({
                        ...f,
                        duration_minutes: Number(e.target.value) || 60,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Zoom / Meet URL *</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={generatingZoom || !scheduleForm.treatment_id}
                    onClick={() => void generateZoomLink()}
                    className="gap-1.5 text-xs"
                  >
                    {generatingZoom ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="size-3.5 text-amber-500" />
                    )}
                    {generatingZoom ? "Generating…" : "Generate Zoom link"}
                  </Button>
                </div>
                <Input
                  required
                  placeholder="Click Generate Zoom link, or paste a URL"
                  value={scheduleForm.meeting_url}
                  onChange={(e) => {
                    const meeting_url = e.target.value;
                    const fromUrl = parseZoomJoinUrl(meeting_url);
                    setScheduleForm((f) => ({
                      ...f,
                      meeting_url,
                      ...(fromUrl.meeting_id
                        ? { meeting_id: fromUrl.meeting_id }
                        : {}),
                      ...(fromUrl.passcode
                        ? { passcode: fromUrl.passcode }
                        : {}),
                    }));
                  }}
                />
                <p className="text-[11px] text-muted-foreground">
                  Generated meetings: join-before-host off, watermark on, cloud
                  recording auto-starts when the session begins.
                </p>
                {(scheduleForm.meeting_id || scheduleForm.passcode) && (
                  <p className="text-[11px] text-muted-foreground">
                    {scheduleForm.meeting_id
                      ? `Meeting ID: ${scheduleForm.meeting_id}`
                      : ""}
                    {scheduleForm.meeting_id && scheduleForm.passcode
                      ? " · "
                      : ""}
                    {scheduleForm.passcode
                      ? `Passcode: ${scheduleForm.passcode}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Instructor</Label>
                <Input
                  value={scheduleForm.instructor_name}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      instructor_name: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                disabled={scheduling || !scheduleForm.treatment_id}
                onClick={() => void addManualLive()}
              >
                {scheduling && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                Add live class
              </Button>

              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => setShowFillAssist((v) => !v)}
              >
                {showFillAssist ? "Hide" : "Show"} fill remaining assist
              </button>
              {showFillAssist && (
                <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Creates only missing sessions for selected modules, spaced
                    by gap days (not a fixed one-class-per-week rotator).
                  </p>
                  <div className="max-h-32 space-y-1 overflow-auto">
                    {moduleBoard
                      .filter((m) => m.remaining > 0)
                      .map((m) => {
                        const checked =
                          scheduleForm.fill_treatment_ids.includes(
                            m.treatment_id,
                          );
                        return (
                          <label
                            key={m.treatment_id}
                            className="flex items-center gap-2 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setScheduleForm((f) => ({
                                  ...f,
                                  fill_treatment_ids: checked
                                    ? f.fill_treatment_ids.filter(
                                        (x) => x !== m.treatment_id,
                                      )
                                    : [
                                        ...f.fill_treatment_ids,
                                        m.treatment_id,
                                      ],
                                }))
                              }
                            />
                            {m.treatment_name} ({m.remaining} left)
                          </label>
                        );
                      })}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Gap days</Label>
                      <Input
                        type="number"
                        min={1}
                        value={scheduleForm.gap_days}
                        onChange={(e) =>
                          setScheduleForm((f) => ({
                            ...f,
                            gap_days: Number(e.target.value) || 7,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={scheduling}
                    onClick={() => void fillRemaining()}
                  >
                    Fill remaining sessions
                  </Button>
                </div>
              )}

              <hr className="border-border" />

              <h3 className="font-semibold">Add hands-on campus day (manual)</h3>
              <p className="text-xs text-muted-foreground">
                Schedule one campus day at a time for a specific module — same
                as live classes, not an auto batch of 9.
              </p>
              <div className="space-y-2">
                <Label>Module *</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                  value={scheduleForm.hands_on_treatment_id}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      hands_on_treatment_id: e.target.value,
                    }))
                  }
                >
                  <option value="">Select module</option>
                  {(moduleBoard.length
                    ? moduleBoard
                    : selected.map((s) => {
                        const t = allTreatments.find(
                          (x) => x.id === s.treatment_id,
                        );
                        return {
                          treatment_id: s.treatment_id,
                          treatment_name: t?.name ?? s.treatment_id,
                        };
                      })
                  ).map((m) => (
                    <option key={m.treatment_id} value={m.treatment_id}>
                      {m.treatment_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Date & time</Label>
                  <Input
                    type="datetime-local"
                    value={scheduleForm.hands_on_starts_at}
                    onChange={(e) =>
                      setScheduleForm((f) => ({
                        ...f,
                        hands_on_starts_at: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (hours)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={scheduleForm.hands_on_duration_hours}
                    onChange={(e) =>
                      setScheduleForm((f) => ({
                        ...f,
                        hands_on_duration_hours: Number(e.target.value) || 8,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input
                  value={scheduleForm.hands_on_venue}
                  onChange={(e) =>
                    setScheduleForm((f) => ({
                      ...f,
                      hands_on_venue: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                variant="secondary"
                disabled={scheduling || !scheduleForm.hands_on_treatment_id}
                onClick={() => void addManualHandsOn()}
              >
                {scheduling && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                Add hands-on day
              </Button>
            </Panel>
          </div>

          <Panel className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                Scheduled events ({filteredEvents.length})
              </h3>
              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                value={eventFilter}
                onChange={(e) =>
                  setEventFilter(
                    e.target.value as "all" | "live_class" | "workshop",
                  )
                }
              >
                <option value="all">All</option>
                <option value="live_class">Live classes</option>
                <option value="workshop">Hands-on days</option>
              </select>
            </div>
            <div className="max-h-[640px] space-y-2 overflow-auto">
              {filteredEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No events yet. Add a live class for a module, or schedule
                  hands-on days.
                </p>
              ) : (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] capitalize"
                          >
                            {ev.type.replace("_", " ")}
                          </Badge>
                          <span className="font-medium line-clamp-1">
                            {ev.title}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(ev.starts_at).toLocaleString("en-IN")}
                          {ev.treatment_name ? ` · ${ev.treatment_name}` : ""}
                          {ev.batch_name ? ` · ${ev.batch_name}` : ""}
                        </p>
                        {ev.type === "live_class" && (
                          <Link
                            href="/admin/live-classes"
                            className="text-[11px] text-primary underline"
                          >
                            Attendance on Live Classes
                          </Link>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => void deleteScheduleEvent(ev.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
