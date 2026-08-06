"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Calendar,
  Loader2,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminDelete, adminGet, adminPatch, adminPost, adminPut } from "@/lib/api/admin-client";
import { toDatetimeLocalValue } from "@/lib/datetime";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";
import {
  LIVE_CLASS_DURATION_MIN,
  LIVE_CLASS_DURATION_MAX,
  LIVE_CLASS_DURATION_MINUTES,
  clampLiveClassDuration,
} from "@/lib/liveClassDuration";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import {
  COURSE_DELIVERY_MODES,
  COURSE_DELIVERY_MODE_LABELS,
  emptyDeliveryModeFlags,
  flagsToModes,
  isHandsOnDelivery,
  modesToFlags,
  normalizeDeliveryModes,
  type CourseDeliveryMode,
  type CourseDeliveryModeFlags,
} from "@/lib/courseDeliveryModes";
import {
  introToEditorHtml,
  isEmptyRichText,
  listFieldToEditorHtml,
  trainingGroupsToEditorHtml,
} from "@/lib/marketingRichText";

type ProgrammeMeta = {
  live_lectures_per_week?: number;
  hands_on_days_total?: number;
  hands_on_months?: number;
  module_count?: number;
  programme_duration_months?: number;
  min_live_attendance_pct?: number;
  min_hands_on_days_attended?: number;
};

type MarketingContent = {
  eligibility?: { intro?: string; items?: string | string[] };
  highlights?: string | string[];
  training_structure?: {
    html?: string;
    groups?: Array<{ title: string; items: string[] }>;
  };
  why_choose?: { intro?: string; items?: string | string[] };
  important_considerations?: string | string[];
};

type CourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url?: string | null;
  status: string;
  list_price: number | null;
  duration_label?: string | null;
  certificate_label?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  programme_meta?: ProgrammeMeta;
  eligible_qualifications?: string[];
  marketing_content?: MarketingContent;
  faqs?: Array<{
    id: string;
    question: string;
    answer: string;
    sort_order: number;
  }>;
  reviews?: Array<{
    id: string;
    person_name: string;
    credentials: string | null;
    rating: number | null;
    quote: string;
    sort_order: number;
  }>;
  treatments: Array<{
    treatment_id: string;
    treatment_name: string;
    sort_order: number;
    hands_on_default: boolean;
    delivery_modes?: CourseDeliveryMode[] | string[] | null;
    live_sessions_planned?: number;
  }>;
};

type CourseMediaItem = {
  id: string;
  kind: "image" | "video";
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  sort_order: number;
  mime_type: string | null;
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
      modes: CourseDeliveryModeFlags;
    }>
  >([]);
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [moduleBoard, setModuleBoard] = useState<ModuleSchedule[]>([]);
  const [tab, setTab] = useState<
    | "details"
    | "programme"
    | "treatments"
    | "faqs"
    | "reviews"
    | "gallery"
    | "schedule"
  >("details");
  const [eventFilter, setEventFilter] = useState<"all" | "live_class" | "workshop">(
    "all",
  );

  const [meta, setMeta] = useState({
    title: "",
    slug: "",
    description: "",
    image_url: "",
    status: "draft",
    list_price: "",
    duration_label: "",
    certificate_label: "",
    starts_on: "",
    ends_on: "",
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
  const [marketing, setMarketing] = useState({
    eligibilityIntro: "",
    eligibilityItems: "",
    highlights: "",
    trainingGroups: "",
    whyChooseIntro: "",
    whyChooseItems: "",
    importantConsiderations: "",
  });

  const [scheduleForm, setScheduleForm] = useState({
    batch_id: "",
    treatment_id: "",
    meeting_url: "",
    meeting_id: "",
    passcode: "",
    host_start_url: "",
    instructor_name: "Senior Faculty Doctor",
    starts_at: toDatetimeLocalValue(new Date(Date.now() + 86400000)),
    duration_minutes: LIVE_CLASS_DURATION_MINUTES,
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
  const [savingFaqs, setSavingFaqs] = useState(false);
  const [savingReviews, setSavingReviews] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [faqs, setFaqs] = useState<
    Array<{ key: string; question: string; answer: string }>
  >([]);
  const [reviews, setReviews] = useState<
    Array<{
      key: string;
      person_name: string;
      credentials: string;
      rating: string;
      quote: string;
    }>
  >([]);
  const [selectedReviewKey, setSelectedReviewKey] = useState<string | null>(
    null,
  );
  const [reviewForm, setReviewForm] = useState({
    person_name: "",
    credentials: "",
    rating: "5",
    quote: "",
  });
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [generatingZoom, setGeneratingZoom] = useState(false);
  const [batchName, setBatchName] = useState("");
  const [showFillAssist, setShowFillAssist] = useState(false);
  const [gallery, setGallery] = useState<CourseMediaItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [savingGalleryItem, setSavingGalleryItem] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<CourseMediaItem | null>(null);
  const [galleryForm, setGalleryForm] = useState({
    kind: "image" as "image" | "video",
    url: "",
    thumbnail_url: "",
    title: "",
    caption: "",
    mime_type: "",
  });

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
          const modes = modesToFlags(
            normalizeDeliveryModes(t.delivery_modes, t.hands_on_default),
          );
          return {
            treatment_id: t.treatment_id,
            hands_on_default: isHandsOnDelivery(
              normalizeDeliveryModes(t.delivery_modes, t.hands_on_default),
            ),
            live_sessions_planned: t.live_sessions_planned ?? 1,
            modes,
          };
        }),
      );
      setMeta({
        title: courseRes.data.title,
        slug: courseRes.data.slug,
        description: courseRes.data.description ?? "",
        image_url: courseRes.data.image_url ?? "",
        status: courseRes.data.status,
        list_price: courseRes.data.list_price?.toString() ?? "",
        duration_label: courseRes.data.duration_label ?? "",
        certificate_label: courseRes.data.certificate_label ?? "",
        starts_on: courseRes.data.starts_on
          ? String(courseRes.data.starts_on).slice(0, 10)
          : "",
        ends_on: courseRes.data.ends_on
          ? String(courseRes.data.ends_on).slice(0, 10)
          : "",
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
      const mc = courseRes.data.marketing_content ?? {};
      setMarketing({
        eligibilityIntro: introToEditorHtml(mc.eligibility?.intro),
        eligibilityItems: listFieldToEditorHtml(mc.eligibility?.items),
        highlights: listFieldToEditorHtml(mc.highlights),
        trainingGroups: trainingGroupsToEditorHtml(
          mc.training_structure?.groups,
          mc.training_structure?.html,
        ),
        whyChooseIntro: introToEditorHtml(mc.why_choose?.intro),
        whyChooseItems: listFieldToEditorHtml(mc.why_choose?.items),
        importantConsiderations: listFieldToEditorHtml(
          mc.important_considerations,
        ),
      });
      setFaqs(
        (courseRes.data.faqs ?? []).map((f) => ({
          key: f.id,
          question: f.question,
          answer: f.answer,
        })),
      );
      setReviews(
        (courseRes.data.reviews ?? []).map((r) => ({
          key: r.id,
          person_name: r.person_name,
          credentials: r.credentials ?? "",
          rating: r.rating != null ? String(r.rating) : "5",
          quote: r.quote,
        })),
      );
      setSelectedReviewKey(null);
      setReviewForm({
        person_name: "",
        credentials: "",
        rating: "5",
        quote: "",
      });
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

  const loadGallery = useCallback(async () => {
    if (!id) return;
    setLoadingGallery(true);
    try {
      const res = await adminGet<{ items: CourseMediaItem[] }>(
        `/api/admin/courses/${id}/media`,
      );
      setGallery(res.data.items ?? []);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load gallery"
          : "Failed to load gallery",
      );
    } finally {
      setLoadingGallery(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === "gallery") void loadGallery();
  }, [tab, loadGallery]);

  function resetGalleryForm() {
    setGalleryForm({
      kind: "image",
      url: "",
      thumbnail_url: "",
      title: "",
      caption: "",
      mime_type: "",
    });
  }

  async function addGalleryItem(e: FormEvent) {
    e.preventDefault();
    if (!galleryForm.url.trim()) {
      toast.error("Upload an image or video first");
      return;
    }
    setSavingGalleryItem(true);
    try {
      await adminPost(`/api/admin/courses/${id}/media`, {
        kind: galleryForm.kind,
        url: galleryForm.url,
        thumbnail_url: galleryForm.thumbnail_url || null,
        title: galleryForm.title || null,
        caption: galleryForm.caption || null,
        mime_type: galleryForm.mime_type || null,
      });
      toast.success("Gallery item added");
      resetGalleryForm();
      await loadGallery();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to add gallery item"
          : "Failed to add gallery item",
      );
    } finally {
      setSavingGalleryItem(false);
    }
  }

  async function updateGalleryMeta(
    item: CourseMediaItem,
    patch: Partial<Pick<CourseMediaItem, "title" | "caption">>,
  ) {
    try {
      await adminPatch(`/api/admin/courses/${id}/media/${item.id}`, patch);
      await loadGallery();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    }
  }

  async function deleteGalleryItem(item: CourseMediaItem) {
    if (!confirm(`Remove “${item.title || item.kind}” from the gallery?`)) return;
    try {
      await adminDelete(`/api/admin/courses/${id}/media/${item.id}`);
      toast.success("Removed from gallery");
      await loadGallery();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Delete failed"
          : "Delete failed",
      );
    }
  }

  async function moveGalleryItem(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= gallery.length) return;
    const ordered = [...gallery];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(next, 0, moved);
    setGallery(ordered);
    try {
      await adminPost(`/api/admin/courses/${id}/media`, {
        ordered_ids: ordered.map((g) => g.id),
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Reorder failed"
          : "Reorder failed",
      );
      await loadGallery();
    }
  }

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSavingDetails(true);
    try {
      await adminPatch(`/api/admin/courses/${id}`, {
        title: meta.title,
        slug: meta.slug,
        description: meta.description || null,
        image_url: meta.image_url || null,
        status: meta.status,
        list_price: meta.list_price ? Number(meta.list_price) : null,
        duration_label: meta.duration_label || null,
        certificate_label: meta.certificate_label || null,
        starts_on: meta.starts_on || null,
        ends_on: meta.ends_on || null,
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
        marketing_content: {
          eligibility: {
            intro: isEmptyRichText(marketing.eligibilityIntro)
              ? undefined
              : marketing.eligibilityIntro,
            items: isEmptyRichText(marketing.eligibilityItems)
              ? undefined
              : marketing.eligibilityItems,
          },
          highlights: isEmptyRichText(marketing.highlights)
            ? undefined
            : marketing.highlights,
          training_structure: {
            html: isEmptyRichText(marketing.trainingGroups)
              ? undefined
              : marketing.trainingGroups,
            groups: [],
          },
          why_choose: {
            intro: isEmptyRichText(marketing.whyChooseIntro)
              ? undefined
              : marketing.whyChooseIntro,
            items: isEmptyRichText(marketing.whyChooseItems)
              ? undefined
              : marketing.whyChooseItems,
          },
          important_considerations: isEmptyRichText(
            marketing.importantConsiderations,
          )
            ? undefined
            : marketing.importantConsiderations,
        },
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
          modes: emptyDeliveryModeFlags({ handson: true }),
        },
      ];
    });
  }

  function toggleMode(treatmentId: string, mode: CourseDeliveryMode) {
    setSelected((prev) =>
      prev.map((p) => {
        if (p.treatment_id !== treatmentId) return p;
        const modes = { ...p.modes, [mode]: !p.modes[mode] };
        const selectedModes = flagsToModes(modes);
        return {
          ...p,
          modes,
          hands_on_default: isHandsOnDelivery(selectedModes),
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
          const delivery_modes = flagsToModes(t.modes);
          return {
            treatment_id: t.treatment_id,
            sort_order: i,
            hands_on_default: isHandsOnDelivery(delivery_modes),
            delivery_modes:
              delivery_modes.length > 0 ? delivery_modes : ["theory"],
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

  async function saveFaqs() {
    const cleaned = faqs
      .map((f) => ({
        question: f.question.trim(),
        answer: f.answer.trim(),
      }))
      .filter((f) => f.question && f.answer);

    if (cleaned.length !== faqs.filter((f) => f.question.trim() || f.answer.trim()).length) {
      toast.error("Each FAQ needs both a question and an answer");
      return;
    }

    setSavingFaqs(true);
    try {
      await adminPut(`/api/admin/courses/${id}/faqs`, {
        faqs: cleaned.map((f, i) => ({
          question: f.question,
          answer: f.answer,
          sort_order: i,
        })),
      });
      toast.success("FAQs saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSavingFaqs(false);
    }
  }

  function moveFaq(index: number, direction: -1 | 1) {
    setFaqs((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  async function saveReviews() {
    const cleaned = reviews
      .map((r) => ({
        person_name: r.person_name.trim(),
        credentials: r.credentials.trim() || null,
        rating: r.rating ? Number(r.rating) : null,
        quote: r.quote.trim(),
      }))
      .filter((r) => r.person_name && r.quote);

    if (
      cleaned.length !==
      reviews.filter((r) => r.person_name.trim() || r.quote.trim()).length
    ) {
      toast.error("Each review needs a name and quote");
      return;
    }

    setSavingReviews(true);
    try {
      await adminPut(`/api/admin/courses/${id}/reviews`, {
        reviews: cleaned.map((r, i) => ({
          person_name: r.person_name,
          credentials: r.credentials,
          rating: r.rating,
          quote: r.quote,
          sort_order: i,
        })),
      });
      toast.success("Reviews saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSavingReviews(false);
    }
  }

  function moveReview(index: number, direction: -1 | 1) {
    setReviews((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  }

  function startNewReview() {
    setSelectedReviewKey(null);
    setReviewForm({
      person_name: "",
      credentials: "",
      rating: "5",
      quote: "",
    });
  }

  function selectReview(key: string) {
    const found = reviews.find((r) => r.key === key);
    if (!found) return;
    setSelectedReviewKey(key);
    setReviewForm({
      person_name: found.person_name,
      credentials: found.credentials,
      rating: found.rating,
      quote: found.quote,
    });
  }

  function applyReviewForm() {
    const person_name = reviewForm.person_name.trim();
    const quote = reviewForm.quote.trim();
    if (!person_name || !quote) {
      toast.error("Name and quote are required");
      return;
    }

    const payload = {
      person_name,
      credentials: reviewForm.credentials.trim(),
      rating: reviewForm.rating || "5",
      quote,
    };

    if (selectedReviewKey) {
      setReviews((prev) =>
        prev.map((r) =>
          r.key === selectedReviewKey ? { ...r, ...payload } : r,
        ),
      );
      toast.success("Review updated in list");
    } else {
      const key = `new-${Date.now()}`;
      setReviews((prev) => [...prev, { key, ...payload }]);
      setSelectedReviewKey(key);
      toast.success("Review added to list");
    }
  }

  function deleteReview(key: string) {
    setReviews((prev) => prev.filter((r) => r.key !== key));
    if (selectedReviewKey === key) startNewReview();
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
        duration_minutes: clampLiveClassDuration(scheduleForm.duration_minutes),
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
        "Zoom link generated (no join before host · watermark)",
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
        duration_minutes: clampLiveClassDuration(scheduleForm.duration_minutes),
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
        duration_minutes: clampLiveClassDuration(scheduleForm.duration_minutes),
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
    { id: "faqs" as const, label: "FAQs" },
    { id: "reviews" as const, label: "Reviews" },
    { id: "gallery" as const, label: "Gallery" },
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
              <RichTextEditor
                value={meta.description}
                onChange={(html) =>
                  setMeta((m) => ({ ...m, description: html }))
                }
                placeholder="Describe the programme for students…"
                minHeightClassName="min-h-[200px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Supports headings, bold, lists, and links. Shown on the public
                course page.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Cover image</Label>
              <GcpFileUpload
                treatmentId={id}
                category="image"
                scope="courses"
                bucket="public"
                stage="cover"
                accept="image/*"
                label="Upload cover image"
                value={meta.image_url || null}
                onChange={(data) =>
                  setMeta((m) => ({ ...m, image_url: data.url }))
                }
                onClear={() => setMeta((m) => ({ ...m, image_url: "" }))}
              />
              <p className="text-[11px] text-muted-foreground">
                Stored in the public bucket. Used on course cards and the public
                course detail page.
              </p>
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
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={meta.starts_on}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, starts_on: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End date (optional)</Label>
                <Input
                  type="date"
                  value={meta.ends_on}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, ends_on: e.target.value }))
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
        <Panel className="max-w-2xl p-5">
          <form onSubmit={saveProgramme} className="space-y-6">
            <div className="space-y-4">
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
                <Label>Eligible qualifications codes (comma-separated)</Label>
                <Textarea
                  rows={2}
                  placeholder="MBBS, BDS, BAMS, MDS, BHMS"
                  value={eligibleText}
                  onChange={(e) => setEligibleText(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used for application validation. Full eligibility copy is below.
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">Eligibility section</h3>
              <div className="space-y-2">
                <Label>Intro</Label>
                <RichTextEditor
                  value={marketing.eligibilityIntro}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, eligibilityIntro: html }))
                  }
                  placeholder="Eligibility intro…"
                  minHeightClassName="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                <RichTextEditor
                  value={marketing.eligibilityItems}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, eligibilityItems: html }))
                  }
                  placeholder="Eligibility items…"
                  minHeightClassName="min-h-[140px]"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">Programme Highlights</h3>
              <div className="space-y-2">
                <Label>Content</Label>
                <RichTextEditor
                  value={marketing.highlights}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, highlights: html }))
                  }
                  placeholder="Programme highlights…"
                  minHeightClassName="min-h-[160px]"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">Training Structure & Delivery</h3>
              <div className="space-y-2">
                <Label>Content</Label>
                <RichTextEditor
                  value={marketing.trainingGroups}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, trainingGroups: html }))
                  }
                  placeholder="Training structure…"
                  minHeightClassName="min-h-[180px]"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">Why Choose Skinfinity Academy?</h3>
              <div className="space-y-2">
                <Label>Intro</Label>
                <RichTextEditor
                  value={marketing.whyChooseIntro}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, whyChooseIntro: html }))
                  }
                  placeholder="Why choose intro…"
                  minHeightClassName="min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <Label>Items</Label>
                <RichTextEditor
                  value={marketing.whyChooseItems}
                  onChange={(html) =>
                    setMarketing((m) => ({ ...m, whyChooseItems: html }))
                  }
                  placeholder="Why choose items…"
                  minHeightClassName="min-h-[140px]"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="font-semibold">Important Considerations</h3>
              <div className="space-y-2">
                <Label>Content</Label>
                <RichTextEditor
                  value={marketing.importantConsiderations}
                  onChange={(html) =>
                    setMarketing((m) => ({
                      ...m,
                      importantConsiderations: html,
                    }))
                  }
                  placeholder="Important considerations…"
                  minHeightClassName="min-h-[160px]"
                />
              </div>
            </div>

            <Button type="submit" disabled={savingProgramme}>
              {savingProgramme && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              Save programme & marketing content
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
                      {COURSE_DELIVERY_MODES.map((mode) => (
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
                          {COURSE_DELIVERY_MODE_LABELS[mode]}
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

      {tab === "faqs" && (
        <Panel className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Course FAQs</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Shown on the public course page under Frequently Asked Questions.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFaqs((prev) => [
                    ...prev,
                    {
                      key: `new-${Date.now()}`,
                      question: "",
                      answer: "",
                    },
                  ])
                }
              >
                <Plus className="size-3.5" />
                Add FAQ
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={savingFaqs}
                onClick={() => void saveFaqs()}
              >
                {savingFaqs && (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                )}
                Save FAQs
              </Button>
            </div>
          </div>

          {faqs.length === 0 ? (
            <EmptyState message="No FAQs yet. Add questions students ask about this programme." />
          ) : (
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <div
                  key={faq.key}
                  className="rounded-xl border border-border/80 bg-muted/10 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      FAQ {index + 1}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === 0}
                        aria-label="Move up"
                        onClick={() => moveFaq(index, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === faqs.length - 1}
                        aria-label="Move down"
                        onClick={() => moveFaq(index, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete FAQ"
                        onClick={() =>
                          setFaqs((prev) =>
                            prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>Question</Label>
                      <Input
                        value={faq.question}
                        placeholder="e.g. Who is eligible for this programme?"
                        onChange={(e) =>
                          setFaqs((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, question: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Answer</Label>
                      <Textarea
                        rows={3}
                        value={faq.answer}
                        placeholder="Write a clear, short answer…"
                        onChange={(e) =>
                          setFaqs((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, answer: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {tab === "reviews" && (
        <div className="grid gap-6 lg:grid-cols-5">
          <Panel className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Reviews</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {reviews.length} saved · select one to edit
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startNewReview}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            </div>

            {reviews.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                No reviews yet. Use the form on the right to add one.
              </p>
            ) : (
              <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {reviews.map((review, index) => {
                  const active = selectedReviewKey === review.key;
                  return (
                    <div
                      key={review.key}
                      className={`rounded-xl border px-3 py-3 transition-colors ${
                        active
                          ? "border-primary bg-primary/5"
                          : "border-border/80 hover:bg-muted/40"
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => selectReview(review.key)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {review.person_name || "Untitled review"}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {review.credentials || "No credentials"}
                            </p>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            {review.rating || "—"}★
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {review.quote || "No quote yet"}
                        </p>
                      </button>
                      <div className="mt-2 flex items-center justify-end gap-0.5 border-t border-border/60 pt-2">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === 0}
                          aria-label="Move up"
                          onClick={() => moveReview(index, -1)}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={index === reviews.length - 1}
                          aria-label="Move down"
                          onClick={() => moveReview(index, 1)}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Delete review"
                          onClick={() => deleteReview(review.key)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 border-t border-border pt-4">
              <Button
                type="button"
                className="w-full"
                disabled={savingReviews}
                onClick={() => void saveReviews()}
              >
                {savingReviews && (
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                )}
                Save all reviews
              </Button>
            </div>
          </Panel>

          <Panel className="space-y-5 p-5 lg:col-span-3">
            <div>
              <h3 className="font-semibold">
                {selectedReviewKey ? "Edit review" : "Add review"}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Fill the form, preview how it looks, then add it to the list.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={reviewForm.person_name}
                  placeholder="Dr. Name"
                  onChange={(e) =>
                    setReviewForm((f) => ({
                      ...f,
                      person_name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Credentials</Label>
                <Input
                  value={reviewForm.credentials}
                  placeholder="MBBS, Aesthetic Physician"
                  onChange={(e) =>
                    setReviewForm((f) => ({
                      ...f,
                      credentials: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:max-w-[140px]">
                <Label>Rating (1–5)</Label>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={0.5}
                  value={reviewForm.rating}
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, rating: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Quote</Label>
                <Textarea
                  rows={4}
                  value={reviewForm.quote}
                  placeholder="What they said about the programme…"
                  onChange={(e) =>
                    setReviewForm((f) => ({ ...f, quote: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={applyReviewForm}>
                {selectedReviewKey ? "Update in list" : "Add to list"}
              </Button>
              {selectedReviewKey ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startNewReview}
                >
                  Clear / new
                </Button>
              ) : null}
            </div>

            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Preview
              </p>
              <article className="rounded-2xl border border-border/80 bg-muted/20 p-5">
                <div className="mb-3 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const rating = Number(reviewForm.rating) || 0;
                    const filled = i < Math.round(rating);
                    return (
                      <span
                        key={i}
                        className={
                          filled ? "text-amber-500" : "text-muted-foreground/40"
                        }
                      >
                        ★
                      </span>
                    );
                  })}
                  <span className="ml-1 text-xs text-muted-foreground">
                    {(Number(reviewForm.rating) || 0).toFixed(1)}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground/80">
                  “
                  {reviewForm.quote.trim() ||
                    "Your review quote will appear here."}
                  ”
                </p>
                <div className="mt-4 border-t border-border/70 pt-3">
                  <p className="text-sm font-semibold">
                    {reviewForm.person_name.trim() || "Doctor name"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reviewForm.credentials.trim() || "Credentials"}
                  </p>
                </div>
              </article>
            </div>
          </Panel>
        </div>
      )}

      {tab === "gallery" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Course gallery</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Images and videos that explain the course on the public detail
                page. Files upload to the public bucket.
              </p>
            </div>

            {loadingGallery ? (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Loading gallery…
              </p>
            ) : gallery.length === 0 ? (
              <EmptyState message="No gallery items yet. Add an image or video on the right." />
            ) : (
              <div className="space-y-3">
                {gallery.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/80 p-3 space-y-3"
                  >
                    <div className="flex gap-3">
                      <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted relative">
                        {item.kind === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.url}
                            alt={item.title || "Gallery image"}
                            className="size-full object-cover"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPreviewVideo(item)}
                            className="relative size-full group"
                            title="Play video"
                          >
                            {item.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.thumbnail_url}
                                alt={item.title || "Video thumbnail"}
                                className="size-full object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center bg-slate-900 text-xs text-white/70">
                                Video
                              </div>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/35 group-hover:bg-black/45 transition-colors">
                              <span className="flex size-8 items-center justify-center rounded-full bg-white text-teal-700 shadow">
                                <Play className="size-3.5 fill-current" />
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {item.kind}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate">
                            #{index + 1}
                          </span>
                        </div>
                        <Input
                          placeholder="Title"
                          defaultValue={item.title ?? ""}
                          onBlur={(e) => {
                            const title = e.target.value.trim();
                            if (title !== (item.title ?? "")) {
                              void updateGalleryMeta(item, { title });
                            }
                          }}
                        />
                        <Input
                          placeholder="Caption (optional)"
                          defaultValue={item.caption ?? ""}
                          onBlur={(e) => {
                            const caption = e.target.value.trim();
                            if (caption !== (item.caption ?? "")) {
                              void updateGalleryMeta(item, { caption });
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.kind === "video" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setPreviewVideo(item)}
                        >
                          <Play className="size-3.5" />
                          Play
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() => void moveGalleryItem(index, -1)}
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={index === gallery.length - 1}
                        onClick={() => void moveGalleryItem(index, 1)}
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="ml-auto text-destructive"
                        onClick={() => void deleteGalleryItem(item)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel className="p-5">
            <form onSubmit={addGalleryItem} className="space-y-4">
              <h3 className="font-semibold">Add gallery item</h3>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
                  value={galleryForm.kind}
                  onChange={(e) =>
                    setGalleryForm((f) => ({
                      ...f,
                      kind: e.target.value as "image" | "video",
                      url: "",
                      thumbnail_url: "",
                      mime_type: "",
                    }))
                  }
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>

              {galleryForm.kind === "image" ? (
                <div className="space-y-2">
                  <Label>Image file</Label>
                  <GcpFileUpload
                    treatmentId={id}
                    category="image"
                    scope="courses"
                    bucket="public"
                    stage="gallery"
                    accept="image/*"
                    label="Upload gallery image"
                    value={galleryForm.url || null}
                    onChange={(data) =>
                      setGalleryForm((f) => ({
                        ...f,
                        url: data.url,
                        mime_type: data.mime_type || "",
                      }))
                    }
                    onClear={() =>
                      setGalleryForm((f) => ({
                        ...f,
                        url: "",
                        mime_type: "",
                      }))
                    }
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Video file</Label>
                    <GcpFileUpload
                      treatmentId={id}
                      category="videos"
                      scope="courses"
                      bucket="public"
                      stage="gallery"
                      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                      label="Upload gallery video"
                      value={galleryForm.url || null}
                      onChange={(data) =>
                        setGalleryForm((f) => ({
                          ...f,
                          url: data.url,
                          mime_type: data.mime_type || "",
                        }))
                      }
                      onClear={() =>
                        setGalleryForm((f) => ({
                          ...f,
                          url: "",
                          mime_type: "",
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Thumbnail (optional)</Label>
                    <GcpFileUpload
                      treatmentId={id}
                      category="thumbnails"
                      scope="courses"
                      bucket="public"
                      stage="gallery"
                      accept="image/*"
                      label="Upload thumbnail"
                      value={galleryForm.thumbnail_url || null}
                      onChange={(data) =>
                        setGalleryForm((f) => ({
                          ...f,
                          thumbnail_url: data.url,
                        }))
                      }
                      onClear={() =>
                        setGalleryForm((f) => ({ ...f, thumbnail_url: "" }))
                      }
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Title (optional)</Label>
                <Input
                  value={galleryForm.title}
                  onChange={(e) =>
                    setGalleryForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="e.g. Hands-on clinic training"
                />
              </div>
              <div className="space-y-2">
                <Label>Caption (optional)</Label>
                <Textarea
                  rows={2}
                  value={galleryForm.caption}
                  onChange={(e) =>
                    setGalleryForm((f) => ({ ...f, caption: e.target.value }))
                  }
                  placeholder="Short explanation for students"
                />
              </div>
              <Button type="submit" disabled={savingGalleryItem}>
                {savingGalleryItem && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                Add to gallery
              </Button>
            </form>
          </Panel>
        </div>
      )}

      <Dialog
        open={!!previewVideo}
        onOpenChange={(open) => !open && setPreviewVideo(null)}
      >
        <DialogContent className="sm:max-w-3xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle>
              {previewVideo?.title || "Gallery video"}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-black aspect-video">
            {previewVideo?.url ? (
              <video
                key={previewVideo.id}
                src={previewVideo.url}
                controls
                autoPlay
                className="h-full w-full object-contain"
                poster={previewVideo.thumbnail_url || undefined}
              />
            ) : null}
          </div>
          {previewVideo?.caption ? (
            <p className="px-4 py-3 text-sm text-muted-foreground border-t">
              {previewVideo.caption}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

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
                    min={LIVE_CLASS_DURATION_MIN}
                    max={LIVE_CLASS_DURATION_MAX}
                    value={scheduleForm.duration_minutes}
                    onChange={(e) =>
                      setScheduleForm((f) => ({
                        ...f,
                        duration_minutes: clampLiveClassDuration(
                          Number(e.target.value),
                        ),
                      }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {LIVE_CLASS_DURATION_MIN}–{LIVE_CLASS_DURATION_MAX} mins
                    (Zoom plan max).
                  </p>
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
                  Generated meetings: join-before-host off, watermark on. Max
                  duration {LIVE_CLASS_DURATION_MAX} minutes.
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
