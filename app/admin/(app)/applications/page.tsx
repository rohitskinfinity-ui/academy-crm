"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { CheckCircle, Loader2, Search, UserPlus, XCircle } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPatch, adminPost } from "@/lib/api/admin-client";

type Application = {
  id: string;
  registration_id: string | null;
  full_name: string;
  email: string;
  highest_qualification: string | null;
  course_title?: string;
  status: string;
  created_at: string;
  qualification_ok?: boolean;
};

type Paginated = {
  items: Application[];
  pagination: { total: number; total_pages: number; page: number };
};

export default function AdminApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/applications", {
        search: search || undefined,
        status: status || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load applications"
          : "Failed to load applications",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(id: string, newStatus: "approved" | "rejected") {
    setActing(id);
    try {
      await adminPatch(`/api/admin/applications/${id}`, { status: newStatus });
      toast.success(`Application ${newStatus}`);
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Review failed"
          : "Review failed",
      );
    } finally {
      setActing(null);
    }
  }

  async function convert(id: string) {
    setActing(id);
    try {
      const res = await adminPost<{ id: string }>(
        `/api/admin/applications/${id}`,
        {},
      );
      toast.success("Enrollment created");
      if (res.data?.id) {
        window.location.href = `/admin/enrollments/${res.data.id}`;
      } else {
        await load();
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Conversion failed"
          : "Conversion failed",
      );
    } finally {
      setActing(null);
    }
  }

  const statusColor = (s: string) => {
    if (s === "approved") return "default";
    if (s === "rejected") return "destructive";
    if (s === "enrolled") return "secondary";
    return "outline";
  };

  return (
    <div>
      <PageHeader
        title="Enrollment Applications"
        description="Review PGDCC applications, verify eligibility, and convert approved applicants to enrollments."
      />

      <Panel className="mb-4 p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, registration ID…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm capitalize"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="enrolled">Enrolled</option>
        </select>
      </Panel>

      {loading ? (
        <EmptyState message="Loading applications…" />
      ) : !data?.items.length ? (
        <EmptyState message="No enrollment applications yet." />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{app.full_name}</p>
                      <p className="text-xs text-muted-foreground">{app.email}</p>
                      {app.registration_id && (
                        <p className="text-[10px] text-muted-foreground">
                          {app.registration_id}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {app.highest_qualification ?? "—"}
                    </span>
                    {app.qualification_ok === false && (
                      <Badge variant="destructive" className="ml-2 text-[10px]">
                        Ineligible
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {app.course_title ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColor(app.status)} className="capitalize">
                      {app.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {app.status === "submitted" ||
                    app.status === "under_review" ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === app.id}
                          onClick={() => void review(app.id, "approved")}
                        >
                          {acting === app.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle className="size-3.5 text-emerald-600" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={acting === app.id}
                          onClick={() => void review(app.id, "rejected")}
                        >
                          <XCircle className="size-3.5 text-destructive" />
                        </Button>
                      </>
                    ) : null}
                    {app.status === "approved" && (
                      <Button
                        size="sm"
                        disabled={acting === app.id}
                        onClick={() => void convert(app.id)}
                        className="gap-1"
                      >
                        {acting === app.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <UserPlus className="size-3.5" />
                        )}
                        Enroll
                      </Button>
                    )}
                    {app.status === "enrolled" && (
                      <Link href={`/admin/applications/${app.id}`}>
                        <Button size="sm" variant="ghost">
                          View
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.pagination.total_pages > 1 && (
            <div className="flex justify-center gap-2 border-t p-3">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm self-center text-muted-foreground">
                Page {page} of {data.pagination.total_pages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= data.pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
