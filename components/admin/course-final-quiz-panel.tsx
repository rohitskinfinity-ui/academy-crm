"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Edit2, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { EmptyState, Panel } from "@/components/admin/page-header";
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
import {
  adminDelete,
  adminGet,
  adminPatch,
  adminPost,
  adminPut,
} from "@/lib/api/admin-client";

type QuizQuestionItem = {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  sort_order: number;
};

type FinalQuiz = {
  id: string;
  title: string;
  pass_percent: number;
  is_published: boolean;
  questions: QuizQuestionItem[];
};

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

export function CourseFinalQuizPanel({ courseId }: { courseId: string }) {
  const [quiz, setQuiz] = useState<FinalQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [quizForm, setQuizForm] = useState({
    title: "Certificate quiz",
    pass_percent: 75,
    is_published: true,
  });
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
  const [bulkQuizModal, setBulkQuizModal] = useState({
    open: false,
    rawText: "",
    importing: false,
  });

  const load = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await adminGet<FinalQuiz | null>(
        `/api/admin/courses/${courseId}/final-quiz`,
      );
      setQuiz(res.data);
      if (res.data) {
        setQuizForm({
          title: res.data.title ?? "Certificate quiz",
          pass_percent: Number(res.data.pass_percent) || 75,
          is_published: res.data.is_published ?? true,
        });
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load certificate quiz"
          : "Failed to load certificate quiz",
      );
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveQuizConfig(e: FormEvent) {
    e.preventDefault();
    setSavingQuiz(true);
    try {
      await adminPut(`/api/admin/courses/${courseId}/final-quiz`, quizForm);
      toast.success("Certificate quiz settings saved");
      await load();
    } catch {
      toast.error("Failed to save quiz settings");
    } finally {
      setSavingQuiz(false);
    }
  }

  function openQuestionDialog(q?: QuizQuestionItem) {
    if (q) {
      const options = Array.isArray(q.options) ? q.options : [];
      setQuestionModal({
        open: true,
        id: q.id,
        prompt: q.prompt,
        options: options.length >= 2 ? [...options] : ["Option A", "Option B"],
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
          `/api/admin/courses/${courseId}/final-quiz/questions/${questionModal.id}`,
          payload,
        );
        toast.success("Question updated");
      } else {
        await adminPost(
          `/api/admin/courses/${courseId}/final-quiz/questions`,
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
        `/api/admin/courses/${courseId}/final-quiz/questions/${questionId}`,
      );
      toast.success("Question deleted");
      await load();
    } catch {
      toast.error("Failed to delete question");
    }
  }

  async function importBulkQuizQuestions() {
    const parsed = parseBulkQuizText(bulkQuizModal.rawText);
    if (!parsed.length) {
      toast.error("No valid questions found in text. Check your formatting.");
      return;
    }

    setBulkQuizModal((b) => ({ ...b, importing: true }));
    let successCount = 0;
    const startOrder = quiz?.questions.length ?? 0;

    try {
      for (let i = 0; i < parsed.length; i++) {
        const q = parsed[i];
        await adminPost(`/api/admin/courses/${courseId}/final-quiz/questions`, {
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
    } catch {
      toast.error(
        `Imported ${successCount} questions before encountering an error.`,
      );
    } finally {
      setBulkQuizModal((b) => ({ ...b, importing: false }));
    }
  }

  const parsedBulkPreview = parseBulkQuizText(bulkQuizModal.rawText);

  if (loading) {
    return (
      <Panel className="p-8 flex items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin mr-2" />
        Loading certificate quiz…
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel className="p-5">
        <p className="text-sm text-muted-foreground mb-4">
          Students unlock this quiz at 90% course progress. Passing (default 75%)
          issues their certificate PDF.
        </p>
        <form
          onSubmit={saveQuizConfig}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div className="space-y-1.5 min-w-[200px]">
            <Label htmlFor="final-quiz-title">Quiz title</Label>
            <Input
              id="final-quiz-title"
              value={quizForm.title}
              onChange={(e) =>
                setQuizForm((q) => ({ ...q, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5 w-32">
            <Label htmlFor="final-quiz-pass">Pass %</Label>
            <Input
              id="final-quiz-pass"
              type="number"
              min={0}
              max={100}
              value={quizForm.pass_percent}
              onChange={(e) =>
                setQuizForm((q) => ({
                  ...q,
                  pass_percent: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              id="final-quiz-pub"
              checked={quizForm.is_published}
              onChange={(e) =>
                setQuizForm((q) => ({ ...q, is_published: e.target.checked }))
              }
              className="size-4 rounded border-input"
            />
            <Label htmlFor="final-quiz-pub" className="text-xs cursor-pointer">
              Published
            </Label>
          </div>
          <Button type="submit" size="sm" variant="outline" disabled={savingQuiz}>
            {savingQuiz && <Loader2 className="size-4 animate-spin mr-1.5" />}
            {savingQuiz ? "Saving..." : "Save quiz settings"}
          </Button>
        </form>
      </Panel>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Questions ({quiz?.questions.length ?? 0})
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setBulkQuizModal({ open: true, rawText: "", importing: false })
            }
          >
            <Sparkles className="size-4 text-amber-500" />
            Auto-Split Quiz Paste
          </Button>
          <Button size="sm" onClick={() => openQuestionDialog()}>
            <Plus className="size-4" />
            Add question
          </Button>
        </div>
      </div>

      <Panel className="divide-y">
        {!quiz?.questions.length ? (
          <EmptyState message="No certificate quiz questions yet. Click Auto-Split Quiz Paste or Add question so students can earn a certificate after 90% progress." />
        ) : (
          quiz.questions.map((q, idx) => (
            <div key={q.id} className="flex items-start justify-between p-4 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                    {idx + 1}
                  </span>
                  <p className="font-medium text-sm">{q.prompt}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pl-7 pt-1">
                  {(Array.isArray(q.options) ? q.options : []).map((opt, oIdx) => (
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
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() => void deleteQuestion(q.id)}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Panel>

      <Dialog
        open={questionModal.open}
        onOpenChange={(open) => setQuestionModal((q) => ({ ...q, open }))}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {questionModal.id ? "Edit question" : "Add quiz question"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSaveQuestion} className="space-y-4">
            <div className="space-y-2">
              <Label>Question prompt *</Label>
              <Textarea
                required
                rows={2}
                value={questionModal.prompt}
                onChange={(e) =>
                  setQuestionModal((q) => ({ ...q, prompt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Options & correct answer</Label>
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
                  <Plus className="size-3.5" /> Add option
                </Button>
              </div>
              <div className="space-y-2">
                {questionModal.options.map((optText, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="final-correct-opt"
                      checked={questionModal.correct_index === oIdx}
                      onChange={() =>
                        setQuestionModal((q) => ({ ...q, correct_index: oIdx }))
                      }
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
                              correct_index: Math.min(
                                q.correct_index,
                                updated.length - 1,
                              ),
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
              <Label>Explanation (optional)</Label>
              <Input
                placeholder="Reasoning for correct answer..."
                value={questionModal.explanation}
                onChange={(e) =>
                  setQuestionModal((q) => ({ ...q, explanation: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setQuestionModal((q) => ({ ...q, open: false }))
                }
              >
                Cancel
              </Button>
              <Button type="submit" disabled={savingQuestion}>
                {savingQuestion && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                {savingQuestion
                  ? "Saving..."
                  : questionModal.id
                    ? "Save question"
                    : "Create question"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkQuizModal.open}
        onOpenChange={(open) => setBulkQuizModal((b) => ({ ...b, open }))}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-amber-500" />
              Auto-Split Quiz Paste
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-muted-foreground">
              Paste questions and options directly. Correct options can be marked
              with a checkmark{" "}
              <code className="rounded bg-muted px-1">✅</code>,{" "}
              <code className="rounded bg-muted px-1">(correct)</code>, or{" "}
              <code className="rounded bg-muted px-1">*</code>.
            </p>

            <Textarea
              rows={8}
              placeholder={`1. How does laser hair reduction work?\n\nA. It removes hair with chemicals\nB. It targets the pigment in hair follicles with light energy ✅\nC. It pulls hair out from the root\nD. It freezes hair follicles\n\n2. Which hair colour typically responds best?\n\nA. Blonde\nB. Dark black hair ✅`}
              value={bulkQuizModal.rawText}
              onChange={(e) =>
                setBulkQuizModal((b) => ({ ...b, rawText: e.target.value }))
              }
              className="font-mono text-xs"
            />

            {parsedBulkPreview.length > 0 && (
              <div className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-600">
                    Detected {parsedBulkPreview.length} Question
                    {parsedBulkPreview.length > 1 ? "s" : ""}
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
                            {String.fromCharCode(65 + oIdx)}. {opt}{" "}
                            {oIdx === pq.correct_index && "✅"}
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
              onClick={() =>
                setBulkQuizModal({ open: false, rawText: "", importing: false })
              }
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={bulkQuizModal.importing || parsedBulkPreview.length === 0}
              onClick={() => void importBulkQuizQuestions()}
            >
              {bulkQuizModal.importing && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              {bulkQuizModal.importing
                ? "Importing Questions..."
                : `Import ${parsedBulkPreview.length} Question${parsedBulkPreview.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
