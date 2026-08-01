"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Eye, MessageSquareQuote, Plus, Search, Trash2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
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

type Testimonial = {
  id: string;
  type: "text" | "video";
  person_name: string;
  credentials: string | null;
  course_label: string | null;
  rating: number | null;
  status: string;
  is_featured: boolean;
  sort_order: number;
};

type Paginated = {
  items: Testimonial[];
  pagination: { total: number; total_pages: number; page: number };
};

export default function AdminTestimonialsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draftId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    person_name: "",
    type: "text",
    quote: "",
    status: "draft",
    video_url: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/testimonials", {
        search: search || undefined,
        type: type || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load testimonials"
          : "Failed to load testimonials",
      );
    } finally {
      setLoading(false);
    }
  }, [search, type, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminPost<Testimonial>("/api/admin/testimonials", {
        person_name: form.person_name,
        type: form.type,
        quote: form.quote,
        status: form.status,
        rating: form.type === "text" ? 5 : null,
        video_url:
          form.type === "video" && form.video_url ? form.video_url : null,
      });
      toast.success("Testimonial created");
      setOpen(false);
      setForm({
        person_name: "",
        type: "text",
        quote: "",
        status: "draft",
        video_url: "",
      });
      if (res.data?.id) {
        window.location.href = `/admin/testimonials/${res.data.id}`;
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
    if (!confirm("Delete this testimonial?")) return;
    setDeletingId(id);
    try {
      await adminDelete(`/api/admin/testimonials/${id}`);
      toast.success("Deleted");
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

  return (
    <div>
      <PageHeader
        title="Testimonials"
        description="Doctor video and written reviews shown on the public testimonials page."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New testimonial
          </Button>
        }
      />

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3.5">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search name, course, quote…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={type}
          onChange={(e) => {
            setPage(1);
            setType(e.target.value);
          }}
        >
          <option value="">All types</option>
          <option value="text">Written</option>
          <option value="video">Video</option>
        </select>
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
          headers={["Person", "Type", "Course", "Status", ""]}
          reservedOffset={300}
        />
      ) : !data?.items.length ? (
        <Panel>
          <EmptyState message="No testimonials yet." />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4">Person</TableHead>
                <TableHead className="h-11 px-4">Type</TableHead>
                <TableHead className="h-11 px-4">Course</TableHead>
                <TableHead className="h-11 px-4">Status</TableHead>
                <TableHead className="h-11 w-24 px-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id} className="h-14">
                  <TableCell className="px-4 py-2.5">
                    <Link
                      href={`/admin/testimonials/${row.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {row.person_name}
                    </Link>
                    <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {row.credentials || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge variant="outline" className="capitalize">
                      {row.type === "video" ? "Video" : "Written"}
                    </Badge>
                    {row.is_featured ? (
                      <Badge variant="secondary" className="ml-1">
                        Featured
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate px-4 py-2.5 text-sm text-muted-foreground">
                    {row.course_label || "—"}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge
                      variant={
                        row.status === "published" ? "secondary" : "outline"
                      }
                      className="capitalize"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/admin/testimonials/${row.id}`}
                        className={cn(
                          buttonVariants({ size: "icon-sm", variant: "ghost" }),
                        )}
                        aria-label="Edit"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete"
                        disabled={deletingId === row.id}
                        onClick={() => void onDelete(row.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareQuote className="size-4" />
              New testimonial
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Doctor / alumni name</Label>
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
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Quote</Label>
              <Input
                required
                value={form.quote}
                onChange={(e) =>
                  setForm((f) => ({ ...f, quote: e.target.value }))
                }
              />
            </div>
            {form.type === "video" ? (
              <div className="space-y-2">
                <Label>Video file</Label>
                <GcpFileUpload
                  treatmentId={draftId}
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
            ) : null}
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
