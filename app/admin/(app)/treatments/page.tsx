"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  BookOpen,
  FileText,
  HelpCircle,
  ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
  Video,
} from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDelete, adminGet, adminPost } from "@/lib/api/admin-client";

type Treatment = {
  id: string;
  slug: string;
  name: string;
  summary: string | null;
  image_url: string | null;
  status: string;
  base_price: number | null;
  currency: string;
  video_count?: number;
  booklet_count?: number;
  question_count?: number;
  stage_count?: number;
};

type Paginated = {
  items: Treatment[];
  pagination: { page: number; total: number; total_pages: number };
};

function TreatmentThumbnail({ url, name }: { url?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <div className="flex size-9 items-center justify-center rounded-md border bg-muted text-muted-foreground shrink-0">
        <ImageIcon className="size-4" />
      </div>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className="size-9 rounded-md object-cover border shrink-0"
    />
  );
}

export default function AdminTreatmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    slug: "",
    name: "",
    summary: "",
    image_url: "",
    status: "draft",
    base_price: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await adminGet<Paginated>("/api/admin/treatments", {
        search: search || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load treatments"
          : "Failed to load treatments",
      );
    }
  }, [search, statusFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminPost<Treatment>("/api/admin/treatments", {
        slug: form.slug,
        name: form.name,
        summary: form.summary || null,
        image_url: form.image_url || null,
        status: form.status,
        base_price: form.base_price ? Number(form.base_price) : null,
        currency: "INR",
        sort_order: 0,
      });
      toast.success("Treatment created");
      setOpen(false);
      setForm({
        slug: "",
        name: "",
        summary: "",
        image_url: "",
        status: "draft",
        base_price: "",
      });
      await load();
      if (res.data?.id) {
        window.location.href = `/admin/treatments/${res.data.id}`;
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

  async function onDeleteConfirm() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/treatments/${deleteId}`);
      toast.success("Treatment deleted");
      setDeleteId(null);
      await load();
    } catch (err) {
      toast.error("Failed to delete treatment");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Treatments"
        description="Master procedure library used to build courses and custom pathways."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            New treatment
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search treatments by name, slug or summary..."
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Filter status:</span>
          <select
            className="h-9 rounded-lg border border-input bg-background px-3 text-xs"
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      <Panel>
        {!data?.items.length ? (
          <EmptyState message="No treatments found matching your criteria." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Base price</TableHead>
                  <TableHead>Learning content</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <TreatmentThumbnail url={t.image_url as string} name={t.name as string} />
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/treatments/${t.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {t.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{t.slug}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "published"
                            ? "default"
                            : t.status === "draft"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t.base_price != null ? `${t.currency} ${t.base_price}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1" title="Videos">
                          <Video className="size-3.5" />
                          {t.video_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1" title="Booklets">
                          <FileText className="size-3.5" />
                          {t.booklet_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1" title="Quiz questions">
                          <HelpCircle className="size-3.5" />
                          {t.question_count ?? 0}
                        </span>
                        <span className="flex items-center gap-1" title="Configured stages">
                          <BookOpen className="size-3.5" />
                          {t.stage_count ?? 0}/4
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/treatments/${t.id}`}>
                          <Button size="sm" variant="outline">
                            Manage
                          </Button>
                        </Link>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteId(t.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                Showing {data.items.length} of {data.pagination.total} treatments
              </span>
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
          </>
        )}
      </Panel>

      {/* New Treatment Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New treatment</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Treatment name *</Label>
              <Input
                id="name"
                required
                placeholder="e.g. Botulinum Toxin"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({
                    ...f,
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
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                required
                placeholder="botulinum-toxin"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                placeholder="Brief description of the treatment procedure..."
                value={form.summary}
                onChange={(e) =>
                  setForm((f) => ({ ...f, summary: e.target.value }))
                }
              />
            </div>

            <GcpFileUpload
              treatmentId={form.slug || "new"}
              category="image"
              accept="image/*"
              label="Treatment cover image"
              value={form.image_url}
              onChange={(res) => setForm((f) => ({ ...f, image_url: res.url }))}
              onClear={() => setForm((f) => ({ ...f, image_url: "" }))}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
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
                <Label htmlFor="price">Base price (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.base_price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, base_price: e.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                {saving ? "Creating..." : "Create treatment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete treatment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to soft-delete this treatment? Existing courses and enrollment associations will be preserved.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={onDeleteConfirm}>
              {deleting ? "Deleting..." : "Delete treatment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
