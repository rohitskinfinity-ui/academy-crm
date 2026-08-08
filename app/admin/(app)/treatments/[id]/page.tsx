"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  Edit2,
  ExternalLink,
  FileText,
  HelpCircle,
  ImageIcon,
  Loader2,
  Plus,
  Play,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  adminPut,
} from "@/lib/api/admin-client";

type StageItem = {
  id?: string;
  stage: string;
  title: string;
  description: string | null;
  checklist?: string[];
  sort_order?: number;
};

type VideoItem = {
  id: string;
  stage: string;
  title: string;
  kind: string;
  duration_seconds: number | null;
  video_url: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
};

type BookletItem = {
  id: string;
  stage: string;
  name: string;
  file_url: string | null;
  drive_url: string | null;
  size_bytes: number | null;
  mime_type: string | null;
};

type QuizQuestionItem = {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  sort_order: number;
};

type TreatmentDetail = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  image_url: string | null;
  status: string;
  base_price: number | null;
  currency: string;
  stages: StageItem[];
  videos: VideoItem[];
  booklets: BookletItem[];
  quiz: {
    id: string;
    title: string;
    pass_percent: number;
    is_required: boolean;
    questions: QuizQuestionItem[];
  } | null;
};

const STAGES = ["theory", "observation", "training", "hands-on"] as const;

function parseBulkQuizText(rawText: string): Array<{
  prompt: string;
  options: string[];
  correct_index: number;
}> {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const results: Array<{
    prompt: string;
    options: string[];
    correct_index: number;
  }> = [];

  let currentPrompt = "";
  let currentOptions: string[] = [];
  let correctIndex = 0;

  for (const line of lines) {
    const isQuestionMatch = line.match(/^(?:\d+[\.\)]\s*|Q\d+[:\.]\s*)(.+)/i);
    const isOptionMatch = line.match(/^(?:[A-Da-d][\.\)]\s*)(.+)/i);

    if (isQuestionMatch && !isOptionMatch) {
      if (currentPrompt && currentOptions.length >= 2) {
        results.push({
          prompt: currentPrompt,
          options: currentOptions,
          correct_index: Math.max(0, correctIndex),
        });
      }
      currentPrompt = isQuestionMatch[1].trim();
      currentOptions = [];
      correctIndex = 0;
    } else if (isOptionMatch) {
      let textStr = isOptionMatch[1].trim();
      let isCorrect = false;

      if (
        textStr.includes("✅") ||
        /\(correct\)/i.test(textStr) ||
        /\[correct\]/i.test(textStr) ||
        textStr.endsWith("*")
      ) {
        isCorrect = true;
        textStr = textStr.replace(/✅|\(correct\)|\[correct\]|\*/gi, "").trim();
      }

      if (isCorrect) {
        correctIndex = currentOptions.length;
      }
      currentOptions.push(textStr);
    } else if (currentPrompt && currentOptions.length === 0) {
      currentPrompt += " " + line;
    }
  }

  if (currentPrompt && currentOptions.length >= 2) {
    results.push({
      prompt: currentPrompt,
      options: currentOptions,
      correct_index: Math.max(0, correctIndex),
    });
  }

  return results;
}

export default function TreatmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [treatment, setTreatment] = useState<TreatmentDetail | null>(null);
  const [meta, setMeta] = useState({
    name: "",
    slug: "",
    summary: "",
    image_url: "",
    status: "draft",
    base_price: "",
  });

  // Stage Modal State
  const [stageModal, setStageModal] = useState<{
    open: boolean;
    stage: string;
    title: string;
    description: string;
    checklist: string[];
  }>({
    open: false,
    stage: "theory",
    title: "",
    description: "",
    checklist: [],
  });
  const [newCheckitem, setNewCheckitem] = useState("");

  // Video Modal State
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    id: string | null;
    stage: string;
    title: string;
    kind: string;
    duration_seconds: string;
    video_url: string;
    thumbnail_url: string;
    is_published: boolean;
  }>({
    open: false,
    id: null,
    stage: "theory",
    title: "",
    kind: "lecture",
    duration_seconds: "",
    video_url: "",
    thumbnail_url: "",
    is_published: true,
  });

  // Booklet Modal State
  const [bookletModal, setBookletModal] = useState<{
    open: boolean;
    id: string | null;
    stage: string;
    name: string;
    file_url: string;
    drive_url: string;
    size_bytes: number | null;
    mime_type: string | null;
  }>({
    open: false,
    id: null,
    stage: "theory",
    name: "",
    file_url: "",
    drive_url: "",
    size_bytes: null,
    mime_type: null,
  });

  // Quiz State
  const [quizForm, setQuizForm] = useState({
    title: "Theory quiz",
    pass_percent: 66,
    is_required: true,
  });

  // Question Modal State
  const [questionModal, setQuestionModal] = useState<{
    open: boolean;
    id: string | null;
    prompt: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }>({
    open: false,
    id: null,
    prompt: "",
    options: ["Option A", "Option B"],
    correct_index: 0,
    explanation: "",
  });

  // Bulk Quiz Paste Modal State
  const [bulkQuizModal, setBulkQuizModal] = useState({
    open: false,
    rawText: "",
    importing: false,
  });

  const [playingVideo, setPlayingVideo] = useState<{ title: string; url: string } | null>(null);
  const [viewingBooklet, setViewingBooklet] = useState<{ name: string; url: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [savingVideo, setSavingVideo] = useState(false);
  const [savingBooklet, setSavingBooklet] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminGet<TreatmentDetail>(`/api/admin/treatments/${id}`);
      setTreatment(res.data);
      setMeta({
        name: res.data.name,
        slug: res.data.slug,
        summary: res.data.summary ?? "",
        image_url: res.data.image_url ?? "",
        status: res.data.status,
        base_price: res.data.base_price?.toString() ?? "",
      });
      if (res.data.quiz) {
        setQuizForm({
          title: res.data.quiz.title ?? "Theory quiz",
          pass_percent: res.data.quiz.pass_percent ?? 66,
          is_required: res.data.quiz.is_required ?? true,
        });
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load treatment"
          : "Failed to load treatment",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Save Treatment Metadata
  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPatch(`/api/admin/treatments/${id}`, {
        name: meta.name,
        slug: meta.slug,
        summary: meta.summary || null,
        image_url: meta.image_url || null,
        status: meta.status,
        base_price: meta.base_price ? Number(meta.base_price) : null,
      });
      toast.success("Treatment metadata saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  }

  // --- STAGE ACTIONS ---
  function openStageDialog(stageName: string) {
    const existing = treatment?.stages.find((s) => s.stage === stageName);
    setStageModal({
      open: true,
      stage: stageName,
      title: existing?.title || `${stageName.toUpperCase()} Stage`,
      description: existing?.description || "",
      checklist: existing?.checklist ? [...existing.checklist] : [],
    });
    setNewCheckitem("");
  }

  async function onSaveStage(e: FormEvent) {
    e.preventDefault();
    setSavingStage(true);
    try {
      await adminPut(`/api/admin/treatments/${id}/stages`, {
        stage: stageModal.stage,
        title: stageModal.title,
        description: stageModal.description || null,
        checklist: stageModal.checklist,
        sort_order: STAGES.indexOf(stageModal.stage as (typeof STAGES)[number]),
      });
      toast.success(`${stageModal.stage} stage updated`);
      setStageModal((s) => ({ ...s, open: false }));
      await load();
    } catch (err) {
      toast.error("Failed to save stage");
    } finally {
      setSavingStage(false);
    }
  }

  // --- VIDEO ACTIONS ---
  function openVideoDialog(video?: VideoItem) {
    if (video) {
      setVideoModal({
        open: true,
        id: video.id,
        stage: video.stage,
        title: video.title,
        kind: video.kind,
        duration_seconds: video.duration_seconds?.toString() || "",
        video_url: video.video_url || "",
        thumbnail_url: video.thumbnail_url || "",
        is_published: video.is_published,
      });
    } else {
      setVideoModal({
        open: true,
        id: null,
        stage: "theory",
        title: "",
        kind: "lecture",
        duration_seconds: "",
        video_url: "",
        thumbnail_url: "",
        is_published: true,
      });
    }
  }

  async function onSaveVideo(e: FormEvent) {
    e.preventDefault();
    setSavingVideo(true);
    try {
      const payload = {
        title: videoModal.title,
        stage: videoModal.stage,
        kind: videoModal.kind,
        duration_seconds: videoModal.duration_seconds
          ? Number(videoModal.duration_seconds)
          : null,
        video_url: videoModal.video_url || null,
        thumbnail_url: videoModal.thumbnail_url || null,
        is_published: videoModal.is_published,
      };

      if (videoModal.id) {
        await adminPatch(
          `/api/admin/treatments/${id}/videos/${videoModal.id}`,
          payload,
        );
        toast.success("Video updated");
      } else {
        await adminPost(`/api/admin/treatments/${id}/videos`, payload);
        toast.success("Video created");
      }
      setVideoModal((v) => ({ ...v, open: false }));
      await load();
    } catch (err) {
      toast.error("Failed to save video");
    } finally {
      setSavingVideo(false);
    }
  }

  async function deleteVideo(videoId: string) {
    if (!confirm("Are you sure you want to delete this video?")) return;
    try {
      await adminDelete(`/api/admin/treatments/${id}/videos/${videoId}`);
      toast.success("Video deleted");
      await load();
    } catch {
      toast.error("Failed to delete video");
    }
  }

  // --- BOOKLET ACTIONS ---
  function openBookletDialog(booklet?: BookletItem) {
    if (booklet) {
      setBookletModal({
        open: true,
        id: booklet.id,
        stage: booklet.stage,
        name: booklet.name,
        file_url: booklet.file_url || "",
        drive_url: booklet.drive_url || "",
        size_bytes: booklet.size_bytes,
        mime_type: booklet.mime_type,
      });
    } else {
      setBookletModal({
        open: true,
        id: null,
        stage: "theory",
        name: "",
        file_url: "",
        drive_url: "",
        size_bytes: null,
        mime_type: null,
      });
    }
  }

  async function onSaveBooklet(e: FormEvent) {
    e.preventDefault();
    setSavingBooklet(true);
    try {
      const payload = {
        name: bookletModal.name,
        stage: bookletModal.stage,
        file_url: bookletModal.file_url || null,
        drive_url: bookletModal.drive_url || null,
        size_bytes: bookletModal.size_bytes,
        mime_type: bookletModal.mime_type,
      };

      if (bookletModal.id) {
        await adminPatch(
          `/api/admin/treatments/${id}/booklets/${bookletModal.id}`,
          payload,
        );
        toast.success("Booklet updated");
      } else {
        await adminPost(`/api/admin/treatments/${id}/booklets`, payload);
        toast.success("Booklet created");
      }
      setBookletModal((b) => ({ ...b, open: false }));
      await load();
    } catch {
      toast.error("Failed to save booklet");
    } finally {
      setSavingBooklet(false);
    }
  }

  async function deleteBooklet(bookletId: string) {
    if (!confirm("Are you sure you want to delete this booklet?")) return;
    try {
      await adminDelete(`/api/admin/treatments/${id}/booklets/${bookletId}`);
      toast.success("Booklet deleted");
      await load();
    } catch {
      toast.error("Failed to delete booklet");
    }
  }

  // --- QUIZ & QUESTION ACTIONS ---
  async function saveQuizConfig(e: FormEvent) {
    e.preventDefault();
    setSavingQuiz(true);
    try {
      await adminPut(`/api/admin/treatments/${id}/quizzes`, quizForm);
      toast.success("Quiz settings saved");
      await load();
    } catch {
      toast.error("Failed to save quiz settings");
    } finally {
      setSavingQuiz(false);
    }
  }

  function openQuestionDialog(q?: QuizQuestionItem) {
    if (q) {
      setQuestionModal({
        open: true,
        id: q.id,
        prompt: q.prompt,
        options: [...q.options],
        correct_index: q.correct_index,
        explanation: q.explanation || "",
      });
    } else {
      setQuestionModal({
        open: true,
        id: null,
        prompt: "",
        options: ["Option A", "Option B"],
        correct_index: 0,
        explanation: "",
      });
    }
  }

  async function onSaveQuestion(e: FormEvent) {
    e.preventDefault();
    setSavingQuestion(true);
    try {
      const payload = {
        prompt: questionModal.prompt,
        options: questionModal.options,
        correct_index: questionModal.correct_index,
        explanation: questionModal.explanation || null,
      };

      if (questionModal.id) {
        await adminPatch(
          `/api/admin/treatments/${id}/quizzes/questions/${questionModal.id}`,
          payload,
        );
        toast.success("Question updated");
      } else {
        await adminPost(
          `/api/admin/treatments/${id}/quizzes/questions`,
          payload,
        );
        toast.success("Question created");
      }
      setQuestionModal((q) => ({ ...q, open: false }));
      await load();
    } catch {
      toast.error("Failed to save question");
    } finally {
      setSavingQuestion(false);
    }
  }

  async function deleteQuestion(questionId: string) {
    if (!confirm("Delete this question?")) return;
    try {
      await adminDelete(
        `/api/admin/treatments/${id}/quizzes/questions/${questionId}`,
      );
      toast.success("Question deleted");
      await load();
    } catch {
      toast.error("Failed to delete question");
    }
  }

  // --- BULK QUIZ IMPORT ACTION ---
  async function importBulkQuizQuestions() {
    const parsed = parseBulkQuizText(bulkQuizModal.rawText);
    if (!parsed.length) {
      toast.error("No valid questions found in text. Check your formatting.");
      return;
    }

    setBulkQuizModal((b) => ({ ...b, importing: true }));
    let successCount = 0;
    const startOrder = treatment?.quiz?.questions?.length ?? 0;

    try {
      for (let i = 0; i < parsed.length; i++) {
        const q = parsed[i];
        await adminPost(`/api/admin/treatments/${id}/quizzes/questions`, {
          prompt: q.prompt,
          options: q.options,
          correct_index: q.correct_index,
          sort_order: startOrder + i,
        });
        successCount++;
      }
      toast.success(`Successfully imported ${successCount} quiz questions!`);
      setBulkQuizModal({ open: false, rawText: "", importing: false });
      await load();
    } catch (err) {
      toast.error(
        `Imported ${successCount} questions before encountering an error.`,
      );
    } finally {
      setBulkQuizModal((b) => ({ ...b, importing: false }));
    }
  }

  if (!treatment) {
    return <EmptyState message="Loading treatment details..." />;
  }

  const parsedBulkPreview = parseBulkQuizText(bulkQuizModal.rawText);

  return (
    <div>
      <Link
        href="/admin/treatments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to treatments
      </Link>

      <PageHeader
        title={treatment.name}
        description="Manage treatment metadata, procedure video lectures, booklets, and theory quizzes."
      />

      <Tabs defaultValue="details">
        <TabsList className="mb-4">
          <TabsTrigger value="details">Details & Cover</TabsTrigger>
          <TabsTrigger value="stages">Stages & Checklists</TabsTrigger>
          <TabsTrigger value="videos">
            Videos ({treatment.videos.length})
          </TabsTrigger>
          <TabsTrigger value="booklets">
            Booklets ({treatment.booklets.length})
          </TabsTrigger>
          <TabsTrigger value="quiz">
            Quiz ({treatment.quiz?.questions.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* DETAILS TAB */}
        <TabsContent value="details">
          <Panel className="p-6">
            <form onSubmit={saveMeta} className="grid max-w-2xl gap-5">
              <div className="space-y-2">
                <Label htmlFor="t-name">Name *</Label>
                <Input
                  id="t-name"
                  required
                  value={meta.name}
                  onChange={(e) => {
                  const name = e.target.value;
                  setMeta((m) => ({
                    ...m,
                    name,
                    slug: name
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                  }));
                }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-slug">Slug *</Label>
                <Input
                  id="t-slug"
                  required
                  value={meta.slug}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, slug: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="t-summary">Summary</Label>
                <Textarea
                  id="t-summary"
                  rows={3}
                  value={meta.summary}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, summary: e.target.value }))
                  }
                />
              </div>

              <GcpFileUpload
                treatmentId={treatment.id}
                category="image"
                accept="image/*"
                label="Treatment Cover Image"
                value={meta.image_url}
                onChange={(res) => setMeta((m) => ({ ...m, image_url: res.url }))}
                onClear={() => setMeta((m) => ({ ...m, image_url: "" }))}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
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
                  <Label>Base Price (INR)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={meta.base_price}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, base_price: e.target.value }))
                    }
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-fit">
                {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {saving ? "Saving Changes..." : "Save changes"}
              </Button>
            </form>
          </Panel>
        </TabsContent>

        {/* STAGES TAB */}
        <TabsContent value="stages">
          <Panel className="divide-y">
            {STAGES.map((stageName) => {
              const existing = treatment.stages.find((s) => s.stage === stageName);
              const checklist = existing?.checklist || [];

              return (
                <div key={stageName} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold capitalize text-base">{stageName}</h3>
                      <Badge variant={existing ? "default" : "secondary"} className="capitalize">
                        {existing ? "Configured" : "Default"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {existing?.title || `${stageName.toUpperCase()} Stage`}
                    </p>
                    {existing?.description &&
                    existing.description.replace(/<[^>]+>/g, "").trim() ? (
                      <div
                        className="rich-text-preview mt-1 text-xs leading-relaxed text-muted-foreground [&_p]:mb-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_strong]:font-semibold"
                        dangerouslySetInnerHTML={{
                          __html: existing.description,
                        }}
                      />
                    ) : null}

                    {checklist.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">Checklist items:</p>
                        <ul className="grid gap-1 pl-1">
                          {checklist.map((item, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-xs">
                              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openStageDialog(stageName)}
                  >
                    <Edit2 className="size-3.5" />
                    Configure Stage
                  </Button>
                </div>
              );
            })}
          </Panel>
        </TabsContent>

        {/* VIDEOS TAB */}
        <TabsContent value="videos">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload procedure lecture videos for this treatment.
            </p>
            <Button size="sm" onClick={() => openVideoDialog()}>
              <Plus className="size-4" />
              Add Video
            </Button>
          </div>

          <Panel className="divide-y">
            {treatment.videos.length === 0 ? (
              <EmptyState message="No videos configured yet for this treatment." />
            ) : (
              treatment.videos.map((v) => (
                <div key={v.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Video className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{v.title}</h4>
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {v.stage}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-[11px]">
                          {v.kind}
                        </Badge>
                        {!v.is_published && (
                          <Badge variant="destructive" className="text-[11px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-md">
                        {v.video_url || "No video URL"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {v.video_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (v.video_url) {
                            setPlayingVideo({ title: v.title, url: v.video_url });
                          }
                        }}
                      >
                        <Play className="size-3.5 fill-primary text-primary" />
                        Play Video
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openVideoDialog(v)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => void deleteVideo(v.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>

        {/* BOOKLETS TAB */}
        <TabsContent value="booklets">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Upload PDF study booklets or link Google Drive presentation slides.
            </p>
            <Button size="sm" onClick={() => openBookletDialog()}>
              <Plus className="size-4" />
              Add Booklet
            </Button>
          </div>

          <Panel className="divide-y">
            {treatment.booklets.length === 0 ? (
              <EmptyState message="No booklets or PDF study material added yet." />
            ) : (
              treatment.booklets.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm">{b.name}</h4>
                        <Badge variant="outline" className="capitalize text-[11px]">
                          {b.stage}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {b.file_url ? `PDF Attached` : b.drive_url ? `Drive: ${b.drive_url}` : "No file attached"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {b.file_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (b.file_url) {
                            setViewingBooklet({ name: b.name, url: b.file_url });
                          }
                        }}
                      >
                        <FileText className="size-3.5 text-blue-600" />
                        Open PDF
                      </Button>
                    )}
                    {b.drive_url && (
                      <a href={b.drive_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline">
                          <ExternalLink className="size-3.5 text-emerald-600" />
                          Open Slides
                        </Button>
                      </a>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => openBookletDialog(b)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => void deleteBooklet(b.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>

        {/* QUIZ TAB */}
        <TabsContent value="quiz" className="space-y-4">
          <Panel className="p-5">
            <form onSubmit={saveQuizConfig} className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5 min-w-[200px]">
                <Label htmlFor="quiz-title">Quiz Title</Label>
                <Input
                  id="quiz-title"
                  value={quizForm.title}
                  onChange={(e) => setQuizForm((q) => ({ ...q, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5 w-32">
                <Label htmlFor="quiz-pass">Pass %</Label>
                <Input
                  id="quiz-pass"
                  type="number"
                  min="0"
                  max="100"
                  value={quizForm.pass_percent}
                  onChange={(e) => setQuizForm((q) => ({ ...q, pass_percent: Number(e.target.value) }))}
                />
              </div>

              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id="quiz-req"
                  checked={quizForm.is_required}
                  onChange={(e) => setQuizForm((q) => ({ ...q, is_required: e.target.checked }))}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="quiz-req" className="text-xs cursor-pointer">
                  Required to unlock Observation
                </Label>
              </div>

              <Button type="submit" size="sm" variant="outline" disabled={savingQuiz}>
                {savingQuiz && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {savingQuiz ? "Saving..." : "Save Quiz Settings"}
              </Button>
            </form>
          </Panel>

          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Quiz Questions ({treatment.quiz?.questions.length ?? 0})</h3>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkQuizModal({ open: true, rawText: "", importing: false })}
              >
                <Sparkles className="size-4 text-amber-500" />
                Auto-Split Quiz Paste
              </Button>
              <Button size="sm" onClick={() => openQuestionDialog()}>
                <Plus className="size-4" />
                Add Question
              </Button>
            </div>
          </div>

          <Panel className="divide-y">
            {!treatment.quiz?.questions.length ? (
              <EmptyState message="No quiz questions added yet. Click Auto-Split Quiz Paste or Add Question to create questions." />
            ) : (
              treatment.quiz.questions.map((q, idx) => (
                <div key={q.id} className="flex items-start justify-between p-4 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {idx + 1}
                      </span>
                      <p className="font-medium text-sm">{q.prompt}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pl-7 pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`rounded px-2.5 py-1 text-xs border ${
                            oIdx === q.correct_index
                              ? "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium dark:bg-emerald-950/30 dark:text-emerald-300"
                              : "border-border bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          {opt} {oIdx === q.correct_index && "✓ (Correct)"}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="pl-7 text-xs italic text-muted-foreground">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => openQuestionDialog(q)}>
                      <Edit2 className="size-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => void deleteQuestion(q.id)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {/* --- STAGE DIALOG --- */}
      <Dialog open={stageModal.open} onOpenChange={(open) => setStageModal((s) => ({ ...s, open }))}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">Configure {stageModal.stage} Stage</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveStage} className="space-y-4">
            <div className="space-y-2">
              <Label>Stage Title</Label>
              <Input
                required
                value={stageModal.title}
                onChange={(e) => setStageModal((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={stageModal.description}
                onChange={(html) =>
                  setStageModal((s) => ({ ...s, description: html }))
                }
                placeholder="Describe what this stage covers…"
                minHeightClassName="min-h-[140px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Checklist Items</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Verify patient medical consent form"
                  value={newCheckitem}
                  onChange={(e) => setNewCheckitem(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (newCheckitem.trim()) {
                      setStageModal((s) => ({
                        ...s,
                        checklist: [...s.checklist, newCheckitem.trim()],
                      }));
                      setNewCheckitem("");
                    }
                  }}
                >
                  Add
                </Button>
              </div>

              <div className="space-y-1 pt-2">
                {stageModal.checklist.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded border bg-muted/30 px-3 py-1.5 text-xs">
                    <span>{item}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setStageModal((s) => ({
                          ...s,
                          checklist: s.checklist.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <X className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStageModal((s) => ({ ...s, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingStage}>
                {savingStage && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {savingStage ? "Saving..." : "Save Stage"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- VIDEO DIALOG --- */}
      <Dialog open={videoModal.open} onOpenChange={(open) => setVideoModal((v) => ({ ...v, open }))}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{videoModal.id ? "Edit Video" : "Add Video"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveVideo} className="space-y-4">
            <div className="space-y-2">
              <Label>Video Title *</Label>
              <Input
                required
                value={videoModal.title}
                onChange={(e) => setVideoModal((v) => ({ ...v, title: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Stage</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize"
                  value={videoModal.stage}
                  onChange={(e) => setVideoModal((v) => ({ ...v, stage: e.target.value }))}
                >
                  {STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Video Kind</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  value={videoModal.kind}
                  onChange={(e) => setVideoModal((v) => ({ ...v, kind: e.target.value }))}
                >
                  <option value="lecture">Lecture</option>
                  <option value="ai_procedure">AI Procedure</option>
                  <option value="clinical">Clinical</option>
                </select>
              </div>
            </div>

            <GcpFileUpload
              treatmentId={treatment.id}
              category="videos"
              stage={videoModal.stage}
              accept="video/*"
              label="Upload Video File"
              value={videoModal.video_url}
              onChange={(res) => setVideoModal((v) => ({ ...v, video_url: res.url }))}
              onClear={() => setVideoModal((v) => ({ ...v, video_url: "" }))}
            />

            <GcpFileUpload
              treatmentId={treatment.id}
              category="thumbnails"
              stage={videoModal.stage}
              accept="image/*"
              label="Upload Video Thumbnail (Optional)"
              value={videoModal.thumbnail_url}
              onChange={(res) => setVideoModal((v) => ({ ...v, thumbnail_url: res.url }))}
              onClear={() => setVideoModal((v) => ({ ...v, thumbnail_url: "" }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  min="0"
                  value={videoModal.duration_seconds}
                  onChange={(e) => setVideoModal((v) => ({ ...v, duration_seconds: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="v-pub"
                  checked={videoModal.is_published}
                  onChange={(e) => setVideoModal((v) => ({ ...v, is_published: e.target.checked }))}
                  className="size-4 rounded border-input"
                />
                <Label htmlFor="v-pub" className="text-xs cursor-pointer">
                  Publish Video immediately
                </Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVideoModal((v) => ({ ...v, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingVideo}>
                {savingVideo && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {savingVideo ? "Saving..." : videoModal.id ? "Save Video" : "Create Video"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- BOOKLET DIALOG --- */}
      <Dialog open={bookletModal.open} onOpenChange={(open) => setBookletModal((b) => ({ ...b, open }))}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bookletModal.id ? "Edit Booklet" : "Add Booklet"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveBooklet} className="space-y-4">
            <div className="space-y-2">
              <Label>Booklet Name *</Label>
              <Input
                required
                value={bookletModal.name}
                onChange={(e) => setBookletModal((b) => ({ ...b, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Stage</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize"
                value={bookletModal.stage}
                onChange={(e) => setBookletModal((b) => ({ ...b, stage: e.target.value }))}
              >
                {STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <GcpFileUpload
              treatmentId={treatment.id}
              category="booklets"
              stage={bookletModal.stage}
              accept=".pdf,.ppt,.pptx"
              label="Upload Booklet PDF"
              value={bookletModal.file_url}
              onChange={(res) =>
                setBookletModal((b) => ({
                  ...b,
                  file_url: res.url,
                  size_bytes: res.size_bytes ?? null,
                  mime_type: res.mime_type ?? null,
                }))
              }
              onClear={() => setBookletModal((b) => ({ ...b, file_url: "" }))}
            />

            <div className="space-y-2">
              <Label>Google Drive Presentation URL (Optional)</Label>
              <Input
                placeholder="https://docs.google.com/presentation/d/..."
                value={bookletModal.drive_url}
                onChange={(e) => setBookletModal((b) => ({ ...b, drive_url: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBookletModal((b) => ({ ...b, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingBooklet}>
                {savingBooklet && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {savingBooklet ? "Saving..." : bookletModal.id ? "Save Booklet" : "Create Booklet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- QUESTION DIALOG --- */}
      <Dialog open={questionModal.open} onOpenChange={(open) => setQuestionModal((q) => ({ ...q, open }))}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{questionModal.id ? "Edit Question" : "Add Quiz Question"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveQuestion} className="space-y-4">
            <div className="space-y-2">
              <Label>Question Prompt *</Label>
              <Textarea
                required
                rows={2}
                value={questionModal.prompt}
                onChange={(e) => setQuestionModal((q) => ({ ...q, prompt: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options & Correct Answer</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setQuestionModal((q) => ({
                      ...q,
                      options: [...q.options, `Option ${q.options.length + 1}`],
                    }))
                  }
                >
                  <Plus className="size-3.5" /> Add Option
                </Button>
              </div>

              <div className="space-y-2">
                {questionModal.options.map((optText, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-opt"
                      checked={questionModal.correct_index === oIdx}
                      onChange={() => setQuestionModal((q) => ({ ...q, correct_index: oIdx }))}
                      className="size-4 shrink-0 text-emerald-600"
                    />
                    <Input
                      value={optText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setQuestionModal((q) => {
                          const updated = [...q.options];
                          updated[oIdx] = val;
                          return { ...q, options: updated };
                        });
                      }}
                    />
                    {questionModal.options.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          setQuestionModal((q) => {
                            const updated = q.options.filter((_, i) => i !== oIdx);
                            return {
                              ...q,
                              options: updated,
                              correct_index: Math.min(q.correct_index, updated.length - 1),
                            };
                          })
                        }
                      >
                        <X className="size-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Explanation (Optional)</Label>
              <Input
                placeholder="Reasoning for correct answer..."
                value={questionModal.explanation}
                onChange={(e) => setQuestionModal((q) => ({ ...q, explanation: e.target.value }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQuestionModal((q) => ({ ...q, open: false }))}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingQuestion}>
                {savingQuestion && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {savingQuestion ? "Saving..." : questionModal.id ? "Save Question" : "Create Question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- BULK QUIZ PASTE DIALOG --- */}
      <Dialog open={bulkQuizModal.open} onOpenChange={(open) => setBulkQuizModal((b) => ({ ...b, open }))}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              Auto-Split Quiz Paste
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-muted-foreground">
              Paste questions and options directly. Correct options can be marked with a checkmark <code className="rounded bg-muted px-1">✅</code>, <code className="rounded bg-muted px-1">(correct)</code>, or <code className="rounded bg-muted px-1">*</code>.
            </p>

            <Textarea
              rows={8}
              placeholder={`1. How does laser hair reduction work?\n\nA. It removes hair with chemicals\nB. It targets the pigment in hair follicles with light energy ✅\nC. It pulls hair out from the root\nD. It freezes hair follicles\n\n2. Which hair colour typically responds best?\n\nA. Blonde\nB. Dark black hair ✅`}
              value={bulkQuizModal.rawText}
              onChange={(e) => setBulkQuizModal((b) => ({ ...b, rawText: e.target.value }))}
              className="font-mono text-xs"
            />

            {/* Live Parsing Preview */}
            {parsedBulkPreview.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-600">
                    Detected {parsedBulkPreview.length} Question{parsedBulkPreview.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-muted-foreground">Preview below</span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-lg border bg-muted/20 divide-y text-xs">
                  {parsedBulkPreview.map((pq, pIdx) => (
                    <div key={pIdx} className="p-3 space-y-1.5">
                      <p className="font-semibold text-foreground">
                        {pIdx + 1}. {pq.prompt}
                      </p>
                      <div className="grid grid-cols-2 gap-1.5 pl-2">
                        {pq.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`rounded px-2 py-0.5 border ${
                              oIdx === pq.correct_index
                                ? "border-emerald-500 bg-emerald-50 font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt} {oIdx === pq.correct_index && "✅"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkQuizModal({ open: false, rawText: "", importing: false })}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={bulkQuizModal.importing || parsedBulkPreview.length === 0}
              onClick={() => void importBulkQuizQuestions()}
            >
              {bulkQuizModal.importing && <Loader2 className="size-4 animate-spin mr-1.5" />}
              {bulkQuizModal.importing
                ? "Importing Questions..."
                : `Import ${parsedBulkPreview.length} Question${parsedBulkPreview.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- PLAY VIDEO POPUP DIALOG --- */}
      <Dialog open={!!playingVideo} onOpenChange={() => setPlayingVideo(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="size-4 text-primary fill-primary" />
              {playingVideo?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="my-2 aspect-video w-full overflow-hidden rounded-xl bg-black shadow-lg">
            {playingVideo?.url && (
              <video
                key={playingVideo.url}
                controls
                autoPlay
                className="size-full object-contain"
              >
                <source src={playingVideo.url} />
                Your browser does not support HTML5 video playback.
              </video>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* --- VIEW BOOKLET POPUP DIALOG --- */}
      <Dialog open={!!viewingBooklet} onOpenChange={() => setViewingBooklet(null)}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="size-4 text-blue-600" />
              {viewingBooklet?.name}
            </DialogTitle>
            {viewingBooklet?.url && (
              <a
                href={viewingBooklet.url}
                target="_blank"
                rel="noreferrer"
                className="mr-6 text-xs text-primary hover:underline flex items-center gap-1"
              >
                Open in New Tab <ExternalLink className="size-3" />
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 w-full overflow-hidden rounded-lg border bg-muted">
            {viewingBooklet?.url && (
              <iframe
                src={viewingBooklet.url}
                className="size-full border-0"
                title={viewingBooklet.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
