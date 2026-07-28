"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
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

type TreatmentDetail = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  status: string;
  base_price: number | null;
  stages: Array<{
    id: string;
    stage: string;
    title: string;
    description: string | null;
  }>;
  videos: Array<{ id: string; title: string; stage: string; kind: string }>;
  booklets: Array<{ id: string; name: string; stage: string }>;
  quiz: {
    id: string;
    title: string;
    pass_percent: number;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      correct_index: number;
    }>;
  } | null;
};

const STAGES = ["theory", "observation", "training", "hands-on"] as const;

export default function TreatmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [treatment, setTreatment] = useState<TreatmentDetail | null>(null);
  const [meta, setMeta] = useState({
    name: "",
    slug: "",
    summary: "",
    status: "draft",
    base_price: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await adminGet<TreatmentDetail>(`/api/admin/treatments/${id}`);
      setTreatment(res.data);
      setMeta({
        name: res.data.name,
        slug: res.data.slug,
        summary: res.data.summary ?? "",
        status: res.data.status,
        base_price: res.data.base_price?.toString() ?? "",
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

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    try {
      await adminPatch(`/api/admin/treatments/${id}`, {
        name: meta.name,
        slug: meta.slug,
        summary: meta.summary || null,
        status: meta.status,
        base_price: meta.base_price ? Number(meta.base_price) : null,
      });
      toast.success("Treatment saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    }
  }

  async function upsertStage(stage: string) {
    const title = prompt(`Title for ${stage} stage`, `${stage} stage`);
    if (!title) return;
    try {
      await adminPut(`/api/admin/treatments/${id}/stages`, {
        stage,
        title,
        checklist: [],
        sort_order: STAGES.indexOf(stage as (typeof STAGES)[number]),
      });
      toast.success("Stage saved");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed"
          : "Failed",
      );
    }
  }

  async function addVideo() {
    const title = prompt("Video title");
    if (!title) return;
    try {
      await adminPost(`/api/admin/treatments/${id}/videos`, {
        title,
        stage: "theory",
        kind: "lecture",
      });
      toast.success("Video added");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed"
          : "Failed",
      );
    }
  }

  async function deleteVideo(videoId: string) {
    try {
      await adminDelete(`/api/admin/treatments/${id}/videos/${videoId}`);
      toast.success("Video removed");
      await load();
    } catch (err) {
      toast.error("Failed to delete video");
    }
  }

  async function addBooklet() {
    const name = prompt("Booklet name");
    if (!name) return;
    try {
      await adminPost(`/api/admin/treatments/${id}/booklets`, {
        name,
        stage: "theory",
      });
      toast.success("Booklet added");
      await load();
    } catch (err) {
      toast.error("Failed to add booklet");
    }
  }

  async function deleteBooklet(bookletId: string) {
    try {
      await adminDelete(`/api/admin/treatments/${id}/booklets/${bookletId}`);
      toast.success("Booklet removed");
      await load();
    } catch {
      toast.error("Failed to delete booklet");
    }
  }

  async function saveQuiz() {
    try {
      await adminPut(`/api/admin/treatments/${id}/quizzes`, {
        title: "Theory quiz",
        pass_percent: 66,
        is_required: true,
      });
      toast.success("Quiz saved");
      await load();
    } catch {
      toast.error("Failed to save quiz");
    }
  }

  async function addQuestion() {
    const promptText = prompt("Question prompt");
    if (!promptText) return;
    try {
      await adminPost(`/api/admin/treatments/${id}/quizzes/questions`, {
        prompt: promptText,
        options: ["Option A", "Option B", "Option C", "Option D"],
        correct_index: 0,
        sort_order: treatment?.quiz?.questions?.length ?? 0,
      });
      toast.success("Question added");
      await load();
    } catch {
      toast.error("Failed to add question");
    }
  }

  async function deleteQuestion(questionId: string) {
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

  if (!treatment) {
    return <EmptyState message="Loading treatment…" />;
  }

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
        description="Edit metadata and nested learning content."
      />

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="stages">Stages</TabsTrigger>
          <TabsTrigger value="videos">Videos</TabsTrigger>
          <TabsTrigger value="booklets">Booklets</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <Panel className="p-5">
            <form onSubmit={saveMeta} className="grid max-w-xl gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={meta.name}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={meta.slug}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, slug: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Textarea
                  value={meta.summary}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, summary: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                    value={meta.status}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, status: e.target.value }))
                    }
                  >
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                    <option value="archived">archived</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Base price</Label>
                  <Input
                    type="number"
                    value={meta.base_price}
                    onChange={(e) =>
                      setMeta((m) => ({ ...m, base_price: e.target.value }))
                    }
                  />
                </div>
              </div>
              <Button type="submit" className="w-fit">
                Save changes
              </Button>
            </form>
          </Panel>
        </TabsContent>

        <TabsContent value="stages" className="mt-4">
          <Panel className="divide-y">
            {STAGES.map((stage) => {
              const existing = treatment.stages.find((s) => s.stage === stage);
              return (
                <div
                  key={stage}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="font-medium capitalize">{stage}</p>
                    <p className="text-sm text-muted-foreground">
                      {existing?.title ?? "Not configured"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void upsertStage(stage)}
                  >
                    {existing ? "Edit" : "Add"}
                  </Button>
                </div>
              );
            })}
          </Panel>
        </TabsContent>

        <TabsContent value="videos" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => void addVideo()}>
              <Plus className="size-4" />
              Add video
            </Button>
          </div>
          <Panel className="divide-y">
            {treatment.videos.length === 0 ? (
              <EmptyState message="No videos yet." />
            ) : (
              treatment.videos.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="font-medium">{v.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.stage} · {v.kind}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void deleteVideo(v.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="booklets" className="mt-4">
          <div className="mb-3 flex justify-end">
            <Button size="sm" onClick={() => void addBooklet()}>
              <Plus className="size-4" />
              Add booklet
            </Button>
          </div>
          <Panel className="divide-y">
            {treatment.booklets.length === 0 ? (
              <EmptyState message="No booklets yet." />
            ) : (
              treatment.booklets.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.stage}</p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void deleteBooklet(b.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="quiz" className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => void saveQuiz()}>
              Ensure quiz exists
            </Button>
            <Button size="sm" onClick={() => void addQuestion()}>
              <Plus className="size-4" />
              Add question
            </Button>
          </div>
          <Panel className="divide-y">
            {!treatment.quiz?.questions?.length ? (
              <EmptyState message="No questions yet." />
            ) : (
              treatment.quiz.questions.map((q, i) => (
                <div
                  key={q.id}
                  className="flex items-start justify-between gap-4 px-5 py-3"
                >
                  <div>
                    <p className="text-xs text-muted-foreground">Q{i + 1}</p>
                    <p className="font-medium">{q.prompt}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Correct: {q.options?.[q.correct_index] ?? "—"}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => void deleteQuestion(q.id)}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
