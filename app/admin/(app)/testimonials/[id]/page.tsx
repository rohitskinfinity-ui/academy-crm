"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Panel,
} from "@/components/admin/page-header";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminDelete,
  adminGet,
  adminPatch,
} from "@/lib/api/admin-client";

type Testimonial = {
  id: string;
  type: "text" | "video";
  person_name: string;
  credentials: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
  course_label: string | null;
  rating: number | null;
  quote: string;
  image_url: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  video_duration: string | null;
  video_title: string | null;
  is_featured: boolean;
  sort_order: number;
  status: string;
  review_date: string | null;
};

export default function AdminTestimonialEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<Testimonial | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    type: "text",
    person_name: "",
    credentials: "",
    role: "",
    company: "",
    location: "",
    course_label: "",
    rating: "5",
    quote: "",
    image_url: "",
    thumbnail_url: "",
    video_url: "",
    video_duration: "",
    video_title: "",
    is_featured: false,
    sort_order: "0",
    status: "draft",
    review_date: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await adminGet<Testimonial>(`/api/admin/testimonials/${id}`);
      setItem(res.data);
      const t = res.data;
      setForm({
        type: t.type || "text",
        person_name: t.person_name || "",
        credentials: t.credentials || "",
        role: t.role || "",
        company: t.company || "",
        location: t.location || "",
        course_label: t.course_label || "",
        rating: t.rating != null ? String(t.rating) : "5",
        quote: t.quote || "",
        image_url: t.image_url || "",
        thumbnail_url: t.thumbnail_url || "",
        video_url: t.video_url || "",
        video_duration: t.video_duration || "",
        video_title: t.video_title || "",
        is_featured: Boolean(t.is_featured),
        sort_order: String(t.sort_order ?? 0),
        status: t.status || "draft",
        review_date: t.review_date ? String(t.review_date).slice(0, 10) : "",
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

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPatch(`/api/admin/testimonials/${id}`, {
        type: form.type,
        person_name: form.person_name,
        credentials: form.credentials || null,
        role: form.role || null,
        company: form.company || null,
        location: form.location || null,
        course_label: form.course_label || null,
        rating: form.rating ? Number(form.rating) : null,
        quote: form.quote,
        image_url: form.image_url || null,
        thumbnail_url: form.thumbnail_url || null,
        video_url: form.video_url || null,
        video_duration: form.video_duration || null,
        video_title: form.video_title || null,
        is_featured: form.is_featured,
        sort_order: Number(form.sort_order) || 0,
        status: form.status,
        review_date: form.review_date || null,
      });
      toast.success("Saved");
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

  async function onDelete() {
    if (!confirm("Delete this testimonial?")) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/testimonials/${id}`);
      toast.success("Deleted");
      router.replace("/admin/testimonials");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Delete failed"
          : "Delete failed",
      );
      setDeleting(false);
    }
  }

  if (!item) {
    return (
      <div>
        <PageHeader title="Testimonial" description="Loading…" />
        <Panel>
          <EmptyState message="Loading testimonial…" />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/testimonials"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to testimonials
      </Link>

      <PageHeader
        title={item.person_name}
        description="Edit written or video testimonial for the public site."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={deleting}
            onClick={() => void onDelete()}
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete
          </Button>
        }
      />

      <Panel className="max-w-2xl p-5">
        <form onSubmit={onSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, type: e.target.value }))
                }
              >
                <option value="text">Written</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Person name</Label>
            <Input
              required
              value={form.person_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, person_name: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Credentials</Label>
              <Input
                placeholder="MD Dermatology, AIIMS"
                value={form.credentials}
                onChange={(e) =>
                  setForm((f) => ({ ...f, credentials: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="New Delhi, India"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Course label</Label>
            <Input
              placeholder="Advanced Injectables & Dermal Fillers"
              value={form.course_label}
              onChange={(e) =>
                setForm((f) => ({ ...f, course_label: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Quote / review</Label>
            <Textarea
              required
              rows={4}
              value={form.quote}
              onChange={(e) =>
                setForm((f) => ({ ...f, quote: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Rating (1–5)</Label>
              <Input
                type="number"
                min={1}
                max={5}
                step={0.5}
                value={form.rating}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rating: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Review date</Label>
              <Input
                type="date"
                value={form.review_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, review_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sort_order: e.target.value }))
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_featured: e.target.checked }))
              }
            />
            Featured on homepage
          </label>

          {form.type === "video" ? (
            <div className="space-y-4 rounded-xl border border-border/80 p-4">
              <p className="text-sm font-medium">Video</p>
              <div className="space-y-2">
                <Label>Video file</Label>
                <GcpFileUpload
                  treatmentId={id}
                  category="videos"
                  scope="testimonials"
                  bucket="public"
                  stage="testimonial-video"
                  accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  label="Upload video"
                  value={form.video_url || null}
                  onChange={(data) =>
                    setForm((f) => ({ ...f, video_url: data.url }))
                  }
                  onClear={() => setForm((f) => ({ ...f, video_url: "" }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Thumbnail</Label>
                <GcpFileUpload
                  treatmentId={id}
                  category="thumbnails"
                  scope="testimonials"
                  bucket="public"
                  stage="testimonial-thumb"
                  accept="image/*"
                  label="Upload thumbnail"
                  value={form.thumbnail_url || null}
                  onChange={(data) =>
                    setForm((f) => ({ ...f, thumbnail_url: data.url }))
                  }
                  onClear={() =>
                    setForm((f) => ({ ...f, thumbnail_url: "" }))
                  }
                />
              </div>
            </div>
          ) : null}
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
}
