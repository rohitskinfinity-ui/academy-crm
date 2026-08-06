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

type EnrollmentRow = {
  id: string;
  type?: "course" | "workshop";
  title: string;
  status: string;
  user_full_name?: string | null;
  user_email?: string | null;
  course_title?: string | null;
  workshop_title?: string | null;
  agreed_price: number | null;
  currency: string;
  payment_type?: string | null;
  amount_paid?: number | null;
  remaining_amount?: number | null;
  started_at: string;
};

function formatMoney(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${currency} ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatJoinDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type Paginated = {
  items: EnrollmentRow[];
  pagination: { total: number; total_pages: number; page: number };
};

type UserOption = { id: string; full_name: string; email: string | null };
type CourseOption = { id: string; title: string };

export default function AdminEnrollmentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
        type: typeFilter || undefined,
        status: statusFilter || undefined,
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
  }, [search, page, typeFilter, statusFilter]);

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
      const res = await adminPost<{ id: string }>("/api/admin/enrollments", {
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
        description="Confirmed student pathways after payment. Pending leads are managed in Enquiries."
        actions={
          <Button onClick={() => void openCreate()}>
            <Plus className="size-4" />
            New enrollment
          </Button>
        }
      />

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search name, email, title…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All types</option>
          <option value="course">Course</option>
          <option value="workshop">Workshop</option>
        </select>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="suspended">Suspended</option>
        </select>
      </Panel>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={[
            "Title",
            "Type",
            "Student",
            "Program",
            "Status",
            "Date",
            "Price",
            "",
          ]}
          rowVariant="plain"
          reservedOffset={280}
        />
      ) : (
        <Panel>
          {!data?.items.length ? (
            <EmptyState message="No confirmed enrollments yet." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead className="w-24 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => {
                    const type =
                      row.type ||
                      (row.workshop_title ? "workshop" : "course");
                    const program =
                      type === "workshop"
                        ? row.workshop_title || row.title
                        : row.course_title || "Custom";
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={`/admin/enrollments/${row.id}`}
                            className="font-medium hover:underline"
                          >
                            {row.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              type === "workshop"
                                ? "border-teal-200 bg-teal-50 text-teal-800"
                                : undefined
                            }
                          >
                            {type === "workshop" ? "Workshop" : "Course"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div>
                            <p>{row.user_full_name ?? "—"}</p>
                            {row.user_email ? (
                              <p className="max-w-[180px] truncate text-xs">
                                {row.user_email}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {program}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatJoinDate(row.started_at)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          <div>
                            <p>
                              {row.agreed_price != null
                                ? formatMoney(row.currency, row.agreed_price)
                                : "—"}
                              {row.payment_type ? (
                                <span className="ml-1 text-xs capitalize">
                                  ({row.payment_type})
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs">
                              Paid {formatMoney(row.currency, row.amount_paid ?? 0)}
                              {row.remaining_amount != null ? (
                                <>
                                  {" "}
                                  · Due{" "}
                                  {formatMoney(
                                    row.currency,
                                    row.remaining_amount,
                                  )}
                                </>
                              ) : null}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/enrollments/${row.id}`}
                            className="text-sm font-medium text-teal-700 hover:underline"
                          >
                            Open
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
