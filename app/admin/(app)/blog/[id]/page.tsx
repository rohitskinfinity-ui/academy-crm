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
  PageSectionTitle,
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

type Category = { id: string; name: string; slug: string };

type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string | null;
  image_url: string | null;
  author_name: string | null;
  category_id: string | null;
  read_time_minutes: number | null;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminBlogEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    image_url: "",
    author_name: "",
    category_id: "",
    read_time_minutes: "5",
    status: "draft",
    seo_title: "",
    seo_description: "",
  });

  const load = useCallback(async () => {
    try {
      const [postRes, catRes] = await Promise.all([
        adminGet<BlogPost>(`/api/admin/blog/${id}`),
        adminGet<Category[]>("/api/admin/blog/categories"),
      ]);
      setPost(postRes.data);
      setCategories(catRes.data ?? []);
      const p = postRes.data;
      setForm({
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt ?? "",
        body: p.body ?? "",
        image_url: p.image_url ?? "",
        author_name: p.author_name ?? "",
        category_id: p.category_id ?? "",
        read_time_minutes: p.read_time_minutes?.toString() ?? "5",
        status: p.status,
        seo_title: p.seo_title ?? "",
        seo_description: p.seo_description ?? "",
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load post"
          : "Failed to load post",
      );
      setPost(null);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPatch(`/api/admin/blog/${id}`, {
        title: form.title,
        slug: form.slug || slugify(form.title),
        excerpt: form.excerpt || null,
        body: form.body || null,
        image_url: form.image_url || null,
        author_name: form.author_name || null,
        category_id: form.category_id || null,
        read_time_minutes: form.read_time_minutes
          ? Number(form.read_time_minutes)
          : null,
        status: form.status,
        seo_title: form.seo_title || null,
        seo_description: form.seo_description || null,
      });
      toast.success("Post saved");
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
    if (!confirm("Delete this blog post?")) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/blog/${id}`);
      toast.success("Post deleted");
      router.push("/admin/blog");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Delete failed"
          : "Delete failed",
      );
    } finally {
      setDeleting(false);
    }
  }

  if (!post) {
    return (
      <div>
        <PageHeader title="Blog post" description="Loading…" />
        <Panel className="p-6">
          <EmptyState message="Loading post…" />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to blog
      </Link>

      <PageHeader
        title={post.title}
        description={`/${post.slug}`}
        actions={
          <Button
            variant="outline"
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

      <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-3">
        <Panel className="space-y-4 p-5 lg:col-span-2">
          <PageSectionTitle title="Content" />
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({
                  ...f,
                  title,
                  slug: f.slug ? f.slug : slugify(title),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              required
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Excerpt</Label>
            <Textarea
              rows={3}
              value={form.excerpt}
              onChange={(e) =>
                setForm((f) => ({ ...f, excerpt: e.target.value }))
              }
              placeholder="Short summary for cards and SEO…"
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <Textarea
              rows={14}
              value={form.body}
              onChange={(e) =>
                setForm((f) => ({ ...f, body: e.target.value }))
              }
              placeholder="Write the full article… Use blank lines between paragraphs."
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-4 p-5">
            <PageSectionTitle title="Publish" />
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
            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={form.category_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category_id: e.target.value }))
                }
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Author</Label>
              <Input
                value={form.author_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, author_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Read time (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={form.read_time_minutes}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    read_time_minutes: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Cover image</Label>
              {form.image_url ? (
                <div className="overflow-hidden rounded-xl border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt="Cover preview"
                    className="h-36 w-full object-cover"
                  />
                </div>
              ) : null}
              <GcpFileUpload
                treatmentId={id}
                category="image"
                stage="blog-cover"
                accept="image/*"
                label="Upload image"
                value={form.image_url || null}
                onChange={(data) =>
                  setForm((f) => ({ ...f, image_url: data.url }))
                }
                onClear={() => setForm((f) => ({ ...f, image_url: "" }))}
              />
              <div className="relative py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="bg-card px-2 relative z-10">or paste URL</span>
                <span className="absolute inset-x-0 top-1/2 border-t border-border" />
              </div>
              <Input
                value={form.image_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image_url: e.target.value }))
                }
                placeholder="https://…"
              />
              <p className="text-[11px] text-muted-foreground">
                Upload a file or paste an external image URL.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save post
            </Button>
          </Panel>

          <Panel className="space-y-4 p-5">
            <PageSectionTitle title="SEO" />
            <div className="space-y-2">
              <Label>SEO title</Label>
              <Input
                value={form.seo_title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seo_title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>SEO description</Label>
              <Textarea
                rows={3}
                value={form.seo_description}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    seo_description: e.target.value,
                  }))
                }
              />
            </div>
          </Panel>
        </div>
      </form>
    </div>
  );
}
