"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adminGet, adminPatch, adminPut } from "@/lib/api/admin-client";

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

type TreatmentOption = {
  id: string;
  name: string;
  slug: string;
};

export default function AdminCourseDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [allTreatments, setAllTreatments] = useState<TreatmentOption[]>([]);
  const [selected, setSelected] = useState<
    Array<{ treatment_id: string; hands_on_default: boolean }>
  >([]);

  const [meta, setMeta] = useState({
    title: "",
    slug: "",
    description: "",
    status: "draft",
    list_price: "",
  });

  const [savingDetails, setSavingDetails] = useState(false);
  const [savingTreatments, setSavingTreatments] = useState(false);

  const load = useCallback(async () => {
    try {
      const [courseRes, treatmentsRes] = await Promise.all([
        adminGet<CourseDetail>(`/api/admin/courses/${id}`),
        adminGet<{ items: TreatmentOption[] }>("/api/admin/treatments", {
          limit: 100,
        }),
      ]);
      setCourse(courseRes.data);
      setAllTreatments(treatmentsRes.data.items ?? []);
      setSelected(
        (courseRes.data.treatments ?? []).map((t) => ({
          treatment_id: t.treatment_id,
          hands_on_default: t.hands_on_default,
        })),
      );
      setMeta({
        title: courseRes.data.title,
        slug: courseRes.data.slug,
        description: courseRes.data.description ?? "",
        status: courseRes.data.status,
        list_price: courseRes.data.list_price?.toString() ?? "",
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
    setSavingDetails(true);
    try {
      await adminPatch(`/api/admin/courses/${id}`, {
        title: meta.title,
        slug: meta.slug,
        description: meta.description || null,
        status: meta.status,
        list_price: meta.list_price ? Number(meta.list_price) : null,
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

  function toggleTreatment(treatmentId: string) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.treatment_id === treatmentId);
      if (exists) return prev.filter((p) => p.treatment_id !== treatmentId);
      return [...prev, { treatment_id: treatmentId, hands_on_default: true }];
    });
  }

  async function saveTreatments() {
    setSavingTreatments(true);
    try {
      await adminPut(`/api/admin/courses/${id}/treatments`, {
        treatments: selected.map((t, i) => ({
          treatment_id: t.treatment_id,
          sort_order: i,
          hands_on_default: t.hands_on_default,
        })),
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

  if (!course) return <EmptyState message="Loading course…" />;

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
        description="Edit course details, attached procedures, and preview student experience."
        actions={
          <Link href={`/admin/courses/${id}/preview`}>
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 shadow-sm">
              <Eye className="size-4" />
              Student View Preview
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 font-semibold">Course Details</h3>
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
                onChange={(e) =>
                  setMeta((m) => ({ ...m, slug: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
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
                  min="0"
                  step="0.01"
                  value={meta.list_price}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, list_price: e.target.value }))
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={savingDetails}>
              {savingDetails && (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              )}
              {savingDetails ? "Saving Details..." : "Save details"}
            </Button>
          </form>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Attached Treatments</h3>
              <p className="text-xs text-muted-foreground">
                Select master procedures included in this course.
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
              {savingTreatments ? "Saving..." : "Save selection"}
            </Button>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
            {allTreatments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No treatments in library yet.
              </p>
            ) : (
              allTreatments.map((t) => {
                const checked = selected.some((s) => s.treatment_id === t.id);
                return (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTreatment(t.id)}
                        className="size-4 rounded border-input text-primary"
                      />
                      <div>
                        <span className="text-sm font-medium">{t.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {t.slug}
                        </p>
                      </div>
                    </div>

                    {checked && (
                      <Badge variant="outline" className="text-[11px]">
                        Included
                      </Badge>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
