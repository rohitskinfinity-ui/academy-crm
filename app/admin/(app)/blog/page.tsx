"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDelete, adminGet, adminPost } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  status: string;
  author_name: string | null;
  category_name?: string | null;
  published_at: string | null;
  updated_at: string;
};

type Paginated = {
  items: BlogPost[];
  pagination: { total: number; total_pages: number; page: number };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminBlogPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    status: "draft",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/blog", {
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load posts"
          : "Failed to load posts",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminPost<BlogPost>("/api/admin/blog", {
        title: form.title,
        slug: form.slug || slugify(form.title),
        status: form.status,
        author_name: "Skinfinity Academy",
      });
      toast.success("Post created");
      setOpen(false);
      setForm({ title: "", slug: "", status: "draft" });
      if (res.data?.id) {
        window.location.href = `/admin/blog/${res.data.id}`;
      } else {
        await load();
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Create failed"
          : "Create failed",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this blog post?")) return;
    setDeletingId(id);
    try {
      await adminDelete(`/api/admin/blog/${id}`);
      toast.success("Post deleted");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Delete failed"
          : "Delete failed",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const statusColor = (s: string) => {
    if (s === "published") return "secondary";
    if (s === "archived") return "outline";
    return "outline";
  };

  return (
    <div>
      <PageHeader
        title="Blog"
        description="Manage blog posts shown on the website."
        actions={
          <Button type="button" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New post
          </Button>
        }
      />

      <Panel className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search title, slug, author…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </Panel>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={["Title", "Category", "Status", "Published", ""]}
          reservedOffset={300}
        />
      ) : !data?.items.length ? (
        <EmptyState message="No blog posts yet." />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4">Title</TableHead>
                <TableHead className="h-11 px-4">Category</TableHead>
                <TableHead className="h-11 px-4">Status</TableHead>
                <TableHead className="h-11 px-4">Published</TableHead>
                <TableHead className="h-11 w-24 px-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id} className="h-14">
                  <TableCell className="px-4 py-2.5">
                    <Link
                      href={`/admin/blog/${row.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {row.title}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      /{row.slug}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                    {row.category_name || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge
                      variant={statusColor(row.status)}
                      className="capitalize"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                    {formatDate(row.published_at)}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <Link
                        href={`/admin/blog/${row.id}`}
                        className={cn(
                          buttonVariants({ size: "icon-sm", variant: "ghost" }),
                        )}
                        title="Edit"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        disabled={deletingId === row.id}
                        onClick={() => void onDelete(row.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border/80 px-4 py-3">
            <p className="text-xs text-muted-foreground">
              {data.pagination.total} total
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Panel>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New blog post</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
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
                    slug: slugify(title),
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
              </select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
