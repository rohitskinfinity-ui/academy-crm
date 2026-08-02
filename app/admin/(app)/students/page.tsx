"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  Eye,
  Loader2,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPatch } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type Student = {
  id: string;
  email: string | null;
  full_name: string;
  is_active: boolean;
  phone: string | null;
  enrollment_count: number;
  active_enrollment_id: string | null;
  active_enrollment_title: string | null;
  current_enrollment_status: string | null;
  last_login_at: string | null;
  created_at: string;
};

type Paginated = {
  items: Student[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

export default function AdminStudentsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/students", {
        search: search || undefined,
        is_active: activeFilter || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load students"
          : "Failed to load students",
      );
    } finally {
      setLoading(false);
    }
  }, [search, activeFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(student: Student) {
    setTogglingId(student.id);
    try {
      await adminPatch(`/api/admin/users/${student.id}`, {
        is_active: !student.is_active,
      });
      toast.success(
        student.is_active ? "Student deactivated" : "Student activated",
      );
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Students"
        description="Student accounts, active status, and current courses."
      />

      <Panel className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search name, email, or phone…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={activeFilter}
          onChange={(e) => {
            setPage(1);
            setActiveFilter(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Panel>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={[
            "Student",
            "Account",
            "Current status",
            "Course",
            "Enrolled",
            "",
          ]}
          reservedOffset={300}
        />
      ) : !data?.items.length ? (
        <EmptyState message="No students found." />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4">Student</TableHead>
                <TableHead className="h-11 px-4">Account</TableHead>
                <TableHead className="h-11 px-4">Current status</TableHead>
                <TableHead className="h-11 px-4">Current course</TableHead>
                <TableHead className="h-11 px-4 text-center">Enrolled</TableHead>
                <TableHead className="h-11 w-24 px-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id} className="h-14">
                  <TableCell className="px-4 py-2.5">
                    <Link
                      href={`/admin/students/${row.id}`}
                      className="font-medium text-foreground hover:text-primary"
                    >
                      {row.full_name}
                    </Link>
                    <p className="max-w-[220px] truncate text-xs text-muted-foreground">
                      {row.email || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <Badge variant={row.is_active ? "secondary" : "outline"}>
                      {row.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    {row.current_enrollment_status ? (
                      <Badge
                        variant={
                          row.current_enrollment_status === "active"
                            ? "secondary"
                            : "outline"
                        }
                        className="capitalize"
                      >
                        {row.current_enrollment_status}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] px-4 py-2.5">
                    {row.active_enrollment_title ? (
                      <Link
                        href={`/admin/enrollments/${row.active_enrollment_id}`}
                        className="block truncate text-sm text-muted-foreground hover:text-primary hover:underline"
                        title={row.active_enrollment_title}
                      >
                        {row.active_enrollment_title}
                      </Link>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-2.5 text-center text-sm tabular-nums">
                    {row.enrollment_count}
                  </TableCell>
                  <TableCell className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <Link
                        href={`/admin/students/${row.id}`}
                        className={cn(
                          buttonVariants({ size: "icon-sm", variant: "ghost" }),
                        )}
                        title="View student"
                        aria-label="View student"
                      >
                        <Eye className="size-4" />
                      </Link>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={
                          row.is_active
                            ? "Deactivate student"
                            : "Activate student"
                        }
                        title={
                          row.is_active ? "Deactivate" : "Activate"
                        }
                        disabled={togglingId === row.id}
                        onClick={() => void toggleActive(row)}
                      >
                        {togglingId === row.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : row.is_active ? (
                          <UserX className="size-4 text-muted-foreground" />
                        ) : (
                          <UserCheck className="size-4 text-primary" />
                        )}
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
              {data.pagination.total_pages > 1
                ? ` · Page ${data.pagination.page} of ${data.pagination.total_pages}`
                : ""}
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
    </div>
  );
}
