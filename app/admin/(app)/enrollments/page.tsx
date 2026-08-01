"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPost } from "@/lib/api/admin-client";

type Enrollment = {
  id: string;
  title: string;
  status: string;
  origin: string;
  agreed_price: number | null;
  currency: string;
  user_full_name?: string;
  user_email?: string;
  course_title?: string;
};

type Paginated = {
  items: Enrollment[];
  pagination: { total: number; total_pages: number };
};

type UserOption = { id: string; full_name: string; email: string | null };
type CourseOption = { id: string; title: string };

export default function AdminEnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [form, setForm] = useState({
    user_id: "",
    course_id: "",
    title: "",
    origin: "catalog",
    agreed_price: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/enrollments", {
        search: search || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load"
          : "Failed to load",
      );
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCreate() {
    setOpen(true);
    try {
      const [u, c] = await Promise.all([
        adminGet<{ items: UserOption[] }>("/api/admin/users", {
          role: "student",
          limit: 100,
        }),
        adminGet<{ items: CourseOption[] }>("/api/admin/courses", {
          limit: 100,
        }),
      ]);
      setUsers(u.data.items ?? []);
      setCourses(c.data.items ?? []);
    } catch {
      toast.error("Failed to load form options");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminPost<Enrollment>("/api/admin/enrollments", {
        user_id: form.user_id,
        course_id: form.course_id || null,
        title: form.title,
        origin: form.origin,
        agreed_price: form.agreed_price ? Number(form.agreed_price) : null,
        currency: "INR",
        status: "active",
      });
      toast.success("Enrollment created");
      setOpen(false);
      if (res.data?.id) {
        window.location.href = `/admin/enrollments/${res.data.id}`;
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

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Student pathways — catalog or fully customized."
        actions={
          <Button onClick={() => void openCreate()}>
            <Plus className="size-4" />
            New enrollment
          </Button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-9 pl-9"
          placeholder="Search enrollments…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
      </div>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={["Title", "Student", "Course", "Status", "Price"]}
          rowVariant="plain"
          reservedOffset={280}
        />
      ) : (
      <Panel>
        {!data?.items.length ? (
          <EmptyState message="No enrollments yet." />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/admin/enrollments/${row.id}`}
                        className="font-medium hover:underline"
                      >
                        {row.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.user_full_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.course_title ?? "Custom"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.agreed_price != null
                        ? `${row.currency} ${row.agreed_price}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {data.pagination.total} total
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
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New enrollment</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <select
                required
                className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                value={form.user_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, user_id: e.target.value }))
                }
              >
                <option value="">Select student…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.email ? `(${u.email})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Course (optional)</Label>
              <select
                className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                value={form.course_id}
                onChange={(e) => {
                  const course_id = e.target.value;
                  const course = courses.find((c) => c.id === course_id);
                  setForm((f) => ({
                    ...f,
                    course_id,
                    title: f.title || course?.title || "",
                    origin: course_id ? "catalog" : "custom",
                  }));
                }}
              >
                <option value="">Custom pathway</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                required
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Agreed price</Label>
              <Input
                type="number"
                value={form.agreed_price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, agreed_price: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
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
