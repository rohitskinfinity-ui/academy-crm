"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  Loader2,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Video,
  X,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminGet } from "@/lib/api/admin-client";

type TreatmentDetail = {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  image_url: string | null;
  base_price: number;
  stages: Array<{
    stage: string;
    title: string;
    description: string | null;
    checklist: string[];
  }>;
  videos: Array<{
    id: string;
    stage: string;
    title: string;
    kind: string;
    video_url: string | null;
    thumbnail_url: string | null;
    is_published: boolean;
  }>;
  booklets: Array<{
    id: string;
    stage: string;
    name: string;
    file_url: string | null;
    drive_url: string | null;
  }>;
  quiz: {
    id: string;
    title: string;
    pass_percent: number;
    is_required: boolean;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      correct_index: number;
      explanation: string | null;
    }>;
  } | null;
};

type CourseDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  list_price: number | null;
  treatments: Array<{
    treatment_id: string;
    treatment_name: string;
    sort_order: number;
    hands_on_default: boolean;
  }>;
};

type LiveClassItem = {
  id: string;
  title: string;
  description: string | null;
  platform: "zoom" | "google_meet";
  meeting_url: string | null;
  drive_url: string | null;
  starts_at: string;
  duration_label: string | null;
  status: "scheduled" | "live" | "completed" | "cancelled";
  instructor_name?: string | null;
  treatment_name?: string | null;
};

export default function StudentCoursePreviewPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [liveClasses, setLiveClasses] = useState<LiveClassItem[]>([]);
  const [activeTreatmentIdx, setActiveTreatmentIdx] = useState(0);
  const [activeTreatmentData, setActiveTreatmentData] =
    useState<TreatmentDetail | null>(null);
  const [loadingTreatment, setLoadingTreatment] = useState(false);
  const [activeStage, setActiveStage] = useState<
    "theory" | "observation" | "training" | "hands-on"
  >("theory");
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);

  const loadCourse = useCallback(async () => {
    try {
      const [courseRes, liveRes] = await Promise.all([
        adminGet<CourseDetail>(`/api/admin/courses/${id}`),
        adminGet<{ items: LiveClassItem[] }>(`/api/admin/live-classes?course_id=${id}`),
      ]);
      setCourse(courseRes.data);
      setLiveClasses(liveRes.data.items ?? []);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load course preview"
          : "Failed to load course preview",
      );
    }
  }, [id]);

  useEffect(() => {
    void loadCourse();
  }, [loadCourse]);

  const loadTreatmentDetail = useCallback(async (treatmentId: string) => {
    setLoadingTreatment(true);
    try {
      const res = await adminGet<TreatmentDetail>(
        `/api/admin/treatments/${treatmentId}`,
      );
      setActiveTreatmentData(res.data);
    } catch {
      setActiveTreatmentData(null);
    } finally {
      setLoadingTreatment(false);
    }
  }, []);

  useEffect(() => {
    if (course?.treatments && course.treatments[activeTreatmentIdx]) {
      const tId = course.treatments[activeTreatmentIdx].treatment_id;
      void loadTreatmentDetail(tId);
    }
  }, [course, activeTreatmentIdx, loadTreatmentDetail]);

  if (!course) {
    return (
      <div className="p-6">
        <EmptyState message="Loading student course preview..." />
      </div>
    );
  }

  const currentCourseTreatment = course.treatments[activeTreatmentIdx];
  const stageChecklists =
    activeTreatmentData?.stages.find((s) => s.stage === activeStage)
      ?.checklist || [];
  const stageVideos =
    activeTreatmentData?.videos.filter((v) => v.stage === activeStage) || [];
  const stageBooklets =
    activeTreatmentData?.booklets.filter((b) => b.stage === activeStage) || [];

  const upcomingLiveClass = liveClasses[0];

  return (
    <div className="min-h-screen bg-background space-y-6 pb-12">
      {/* Top Banner Navigation */}
      <div className="flex items-center justify-between border-b bg-card px-6 py-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/courses/${course.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Course Management
          </Link>
          <span className="text-muted-foreground">•</span>
          <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-400">
            <Sparkles className="size-4 text-amber-500" />
            Student Portal Live Preview
          </div>
        </div>

        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          Enrolled Student Mode
        </Badge>
      </div>

      {/* Hero Course Header */}
      <div className="mx-auto max-w-7xl px-6 space-y-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shadow-xl">
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30">
                Master Certification Course
              </Badge>
              <Badge variant="outline" className="text-slate-300 border-slate-700">
                {course.treatments.length} Procedure Modules
              </Badge>
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {course.title}
            </h1>

            <p className="max-w-3xl text-sm text-slate-300 leading-relaxed">
              {course.description ||
                "Comprehensive clinical cosmetology & aesthetic medicine pathway. Learn theory through HD video lectures, study PDF booklets, pass end-of-stage quizzes, and complete hands-on live patient procedures under doctor supervision."}
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-3 text-xs text-slate-300 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Course Fee:</span>
                <strong className="text-emerald-400 font-bold text-sm">
                  INR {course.list_price || "0.00"}
                </strong>
              </div>
              <div>•</div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Included Stages:</span>
                <span className="font-semibold text-slate-200">
                  Theory → Observation → Training → Hands-on
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* WEEKLY LIVE DOCTOR CONNECT BANNER */}
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-950/40 via-indigo-950/30 to-slate-900/40 p-5 backdrop-blur-md shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-400 uppercase tracking-wider">
                <Video className="size-4 text-violet-400" />
                Weekly Doctor Connect — Live Class (1 Hour / Week)
              </div>

              {upcomingLiveClass ? (
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {upcomingLiveClass.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Faculty Doctor:{" "}
                    <strong className="text-foreground">
                      {upcomingLiveClass.instructor_name || "Senior Doctor"}
                    </strong>{" "}
                    • Scheduled:{" "}
                    {new Date(upcomingLiveClass.starts_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Next Weekly Live Session: Friday 4:00 PM IST
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Senior faculty doctors connect weekly via Zoom / Google Meet to review booklet PPTs and answer clinical questions.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {upcomingLiveClass?.drive_url && (
                <a
                  href={upcomingLiveClass.drive_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                    <ExternalLink className="size-3.5" />
                    Open Booklet PPT (Google Drive)
                  </Button>
                </a>
              )}

              {upcomingLiveClass?.meeting_url ? (
                <a
                  href={upcomingLiveClass.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm font-semibold">
                    <Video className="size-4" />
                    🚀 Join Live Class ({upcomingLiveClass.platform === "zoom" ? "Zoom" : "Google Meet"})
                  </Button>
                </a>
              ) : (
                <a
                  href="https://zoom.us"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button size="sm" className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm font-semibold">
                    <Video className="size-4" />
                    🚀 Join Live Zoom Class
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Student Portal Workspace */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Course Syllabus Navigation */}
          <div className="lg:col-span-4 space-y-3">
            <Panel className="p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <BookOpen className="size-4 text-violet-600" />
                  Course Syllabus
                </h3>
                <span className="text-xs text-muted-foreground font-medium">
                  {course.treatments.length} Modules
                </span>
              </div>

              <div className="space-y-2 max-h-[680px] overflow-y-auto pr-1">
                {course.treatments.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">
                    No procedures included in this course yet.
                  </p>
                ) : (
                  course.treatments.map((tr, idx) => (
                    <button
                      key={tr.treatment_id}
                      type="button"
                      onClick={() => {
                        setActiveTreatmentIdx(idx);
                        setActiveStage("theory");
                        setSelectedAnswers({});
                        setPlayingVideoUrl(null);
                        setViewingPdfUrl(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border text-xs transition-all ${
                        activeTreatmentIdx === idx
                          ? "border-violet-600 bg-violet-50/50 dark:bg-violet-950/30 font-semibold shadow-xs"
                          : "border-border hover:bg-muted/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground text-sm line-clamp-1">
                          {idx + 1}. {tr.treatment_name}
                        </span>
                        {activeTreatmentIdx === idx && (
                          <CheckCircle2 className="size-4 text-violet-600 shrink-0 ml-2" />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge
                          variant="secondary"
                          className="text-[10px] bg-slate-100 dark:bg-slate-800"
                        >
                          4 Stages
                        </Badge>
                        <Badge
                          variant={tr.hands_on_default ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {tr.hands_on_default
                            ? "Hands-on Included"
                            : "Theory Only"}
                        </Badge>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Panel>
          </div>

          {/* Right Column: Selected Procedure Module & 4 Stages */}
          <div className="lg:col-span-8 space-y-5">
            {currentCourseTreatment ? (
              <Panel className="p-6 space-y-6">
                {/* Module Title Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {currentCourseTreatment.treatment_name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeTreatmentData?.summary ||
                        "Master procedural module for aesthetic medical training."}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="capitalize text-xs font-semibold px-3 py-1"
                  >
                    {activeStage} Stage Active
                  </Badge>
                </div>

                {/* 4 Stages Tab Switcher */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    ["theory", "observation", "training", "hands-on"] as const
                  ).map((stg, sIdx) => (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => {
                        setActiveStage(stg);
                        setPlayingVideoUrl(null);
                        setViewingPdfUrl(null);
                      }}
                      className={`p-3 rounded-xl border text-center text-xs capitalize font-medium transition-all ${
                        activeStage === stg
                          ? "border-violet-600 bg-violet-600 text-white font-bold shadow-md"
                          : "border-border bg-card hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <span className="block text-[10px] opacity-80 uppercase tracking-wider mb-0.5">
                        Stage {sIdx + 1}
                      </span>
                      {stg}
                    </button>
                  ))}
                </div>

                {loadingTreatment ? (
                  <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <Loader2 className="size-6 animate-spin text-violet-600" />
                    Loading procedural learning content...
                  </div>
                ) : (
                  <>
                    {/* STAGE 1: THEORY */}
                    {activeStage === "theory" && (
                      <div className="space-y-6">
                        {/* Video Lectures */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <Video className="size-4 text-violet-600" />
                            1. Procedure Video Lectures (
                            {stageVideos.length > 0 ? stageVideos.length : 1})
                          </h4>

                          {stageVideos.length > 0 && stageVideos[0]?.video_url ? (
                            <div className="space-y-2">
                              <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
                                <video
                                  key={
                                    playingVideoUrl || stageVideos[0].video_url
                                  }
                                  controls
                                  className="size-full object-contain"
                                >
                                  <source
                                    src={
                                      playingVideoUrl ||
                                      stageVideos[0].video_url
                                    }
                                  />
                                  Your browser does not support HTML5 video.
                                </video>
                              </div>
                              <p className="text-xs font-medium text-foreground">
                                {stageVideos[0].title}
                              </p>
                            </div>
                          ) : (
                            <div className="aspect-video w-full rounded-xl bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center shadow-lg relative overflow-hidden group">
                              <div className="size-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform cursor-pointer">
                                <Play className="size-7 text-white fill-white ml-1" />
                              </div>
                              <p className="text-sm font-semibold text-slate-100 mt-3">
                                {currentCourseTreatment.treatment_name} — Theory
                                Lecture
                              </p>
                              <span className="text-xs text-slate-400 mt-1">
                                Full HD Video Lecture • Sample Demonstration
                              </span>
                            </div>
                          )}
                        </div>

                        {/* PDF Study Booklets & Drive PPT */}
                        <div className="space-y-3 border-t pt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                            <FileText className="size-4 text-blue-600" />
                            2. Study Booklet & Live Doctor Connect Slides
                          </h4>

                          {stageBooklets.length > 0 ? (
                            <div className="space-y-2">
                              {stageBooklets.map((b) => (
                                <div
                                  key={b.id}
                                  className="flex items-center justify-between rounded-xl border bg-card p-3.5 text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                      <FileText className="size-4" />
                                    </div>
                                    <div>
                                      <p className="font-semibold text-foreground">
                                        {b.name}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground">
                                        Official Study Manual
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {b.file_url && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          setViewingPdfUrl(b.file_url)
                                        }
                                        className="gap-1"
                                      >
                                        <ExternalLink className="size-3" />
                                        View PDF
                                      </Button>
                                    )}
                                    {b.drive_url && (
                                      <a
                                        href={b.drive_url}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 text-emerald-600 border-emerald-500/30"
                                        >
                                          <ExternalLink className="size-3" />
                                          Open Slides (Google Drive)
                                        </Button>
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-between rounded-xl border bg-card p-4 text-xs shadow-2xs">
                              <div className="flex items-center gap-3">
                                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                                  <FileText className="size-4" />
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {currentCourseTreatment.treatment_name}{" "}
                                    Clinical Handbook.pdf
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    Skinfinity Academy Procedure Guide
                                  </p>
                                </div>
                              </div>
                              <Button size="sm" variant="outline">
                                View Manual
                              </Button>
                            </div>
                          )}

                          {viewingPdfUrl && (
                            <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground">
                                  Embedded PDF Viewer
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setViewingPdfUrl(null)}
                                >
                                  <X className="size-4" />
                                </Button>
                              </div>
                              <div className="h-[450px] w-full rounded-lg border overflow-hidden">
                                <iframe
                                  src={viewingPdfUrl}
                                  className="size-full border-0"
                                  title="PDF Booklet"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* End-of-Theory Quiz */}
                        <div className="space-y-3 border-t pt-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <HelpCircle className="size-4 text-amber-500" />
                              3. End-of-Theory Quiz (Required 66% Score to Pass)
                            </h4>
                            <Badge variant="secondary" className="text-[10px]">
                              {activeTreatmentData?.quiz?.questions.length ??
                                1}{" "}
                              Questions
                            </Badge>
                          </div>

                          {activeTreatmentData?.quiz?.questions &&
                          activeTreatmentData.quiz.questions.length > 0 ? (
                            <div className="space-y-4">
                              {activeTreatmentData.quiz.questions.map(
                                (q, qIdx) => (
                                  <div
                                    key={q.id}
                                    className="rounded-xl border bg-card p-4 space-y-3 shadow-2xs"
                                  >
                                    <p className="text-xs font-semibold text-foreground">
                                      Q{qIdx + 1}: {q.prompt}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                      {q.options.map((opt, oIdx) => {
                                        const selectedIdx =
                                          selectedAnswers[q.id];
                                        const isSelected = selectedIdx === oIdx;
                                        const isCorrect =
                                          oIdx === q.correct_index;

                                        return (
                                          <button
                                            key={oIdx}
                                            type="button"
                                            onClick={() =>
                                              setSelectedAnswers((prev) => ({
                                                ...prev,
                                                [q.id]: oIdx,
                                              }))
                                            }
                                            className={`text-left p-3 rounded-lg border transition-all ${
                                              isSelected
                                                ? isCorrect
                                                  ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300"
                                                  : "border-destructive bg-destructive/10 text-destructive font-semibold"
                                                : "border-border hover:bg-muted/50 text-foreground"
                                            }`}
                                          >
                                            {String.fromCharCode(65 + oIdx)}.{" "}
                                            {opt}
                                            {isSelected &&
                                              (isCorrect
                                                ? " ✅ Correct"
                                                : " ❌ Incorrect")}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {selectedAnswers[q.id] !== undefined &&
                                      q.explanation && (
                                        <p className="text-[11px] text-muted-foreground bg-muted p-2.5 rounded-lg border border-border/50">
                                          💡 <strong>Explanation:</strong>{" "}
                                          {q.explanation}
                                        </p>
                                      )}
                                  </div>
                                ),
                              )}
                            </div>
                          ) : (
                            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-2xs text-xs">
                              <p className="font-semibold text-foreground">
                                Q1: What is the primary clinical objective when
                                performing {currentCourseTreatment.treatment_name}?
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[
                                  "Targeted tissue rejuvenation & barrier enhancement ✅",
                                  "Permanent nerve ablation",
                                  "Systemic oral absorption",
                                  "Epidermal freezing",
                                ].map((opt, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 rounded-lg border border-border bg-muted/30"
                                  >
                                    {String.fromCharCode(65 + idx)}. {opt}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STAGE 2: OBSERVATION */}
                    {activeStage === "observation" && (
                      <div className="space-y-4 border rounded-xl p-5 bg-muted/10">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Eye className="size-4 text-blue-600" />
                          Observation Stage Checklist & Case Logbook
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enrolled students observe senior faculty doctors in
                          live consultations and clinical cases.
                        </p>

                        <div className="space-y-2 text-xs">
                          {stageChecklists.length > 0 ? (
                            stageChecklists.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs"
                              >
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Observe 3 Live Patient Consultations & Case
                                  Studies
                                </span>
                              </div>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Record Patient Fitzpatrick Skin Type & Dosage
                                  Logbook Entries
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STAGE 3: TRAINING */}
                    {activeStage === "training" && (
                      <div className="space-y-4 border rounded-xl p-5 bg-muted/10">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <Award className="size-4 text-amber-500" />
                          Simulation & Equipment Calibration Drills
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Practical simulation on mannequins, grid markings, and
                          device parameter drills.
                        </p>

                        <div className="space-y-2 text-xs">
                          {stageChecklists.length > 0 ? (
                            stageChecklists.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs"
                              >
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Demonstrate Mannequin Grid Markings & Injection
                                  Pathways
                                </span>
                              </div>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Calibrate Machine Energy Parameters & Handpiece
                                  Pass Speeds
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* STAGE 4: HANDS-ON */}
                    {activeStage === "hands-on" && (
                      <div className="space-y-4 border rounded-xl p-5 bg-muted/10">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          <ShieldCheck className="size-4 text-emerald-600" />
                          Supervised Live Patient Hands-On Execution
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Students perform live patient procedure under 1-on-1
                          senior doctor faculty supervision.
                        </p>

                        <div className="space-y-2 text-xs">
                          {stageChecklists.length > 0 ? (
                            stageChecklists.map((item, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs"
                              >
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>{item}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Verify Patient Medical Consent & Patient
                                  History
                                </span>
                              </div>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Execute Live Patient Procedure under Faculty
                                  Supervision
                                </span>
                              </div>
                              <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-2xs">
                                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                                <span>
                                  Faculty Doctor Sign-off & Competency
                                  Certification
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Panel>
            ) : (
              <EmptyState message="No procedure selected for preview." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
