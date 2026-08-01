"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle,
  Eye,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminGet, adminPatch } from "@/lib/api/admin-client";

type Enquiry = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  topic: string | null;
  message: string | null;
  status: string;
  created_at: string;
};

type Paginated = {
  items: Enquiry[];
  pagination: { total: number; total_pages: number; page: number };
};

function formatShortDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [selected, setSelected] = useState<Enquiry | null>(null);

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
      setSelected((prev) => {
        if (!prev) return null;
        return res.data.items.find((item) => item.id === prev.id) ?? prev;
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load enquiries"
          : "Failed to load enquiries",
      );
    } finally {
      setLoading(false);
    }
  }, [search, status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setEnquiryStatus(
    id: string,
    newStatus: "contacted" | "closed" | "new",
  ) {
    setActing(true);
    try {
      await adminPatch(`/api/admin/applications/${id}`, { status: newStatus });
      toast.success(`Enquiry marked ${newStatus}`);
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    } finally {
      setActing(false);
    }
  }

  const statusColor = (s: string) => {
    if (s === "contacted") return "default";
    if (s === "closed") return "secondary";
    if (s === "spam") return "destructive";
    return "outline";
  };

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Contact-form enquiries from the website. Course purchases go straight to Enrollments."
      />

      <Panel className="mb-4 flex flex-wrap gap-3 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, topic…"
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
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="closed">Closed</option>
          <option value="spam">Spam</option>
        </select>
      </Panel>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={["Name", "Topic", "Status", "Date", ""]}
          reservedOffset={340}
        />
      ) : !data?.items.length ? (
        <EmptyState message="No enquiries yet." />
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-14 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <p className="font-medium">{row.full_name || "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.email || "—"}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm capitalize">
                    {row.topic || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusColor(row.status)}
                      className="capitalize"
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatShortDate(row.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="View enquiry"
                      onClick={() => setSelected(row)}
                    >
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {data && data.pagination.total_pages > 1 ? (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.total_pages} ·{" "}
            {data.pagination.total} total
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
      ) : null}

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent side="right" className="sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader className="border-b border-border pr-10">
                <SheetTitle>{selected.full_name || "Enquiry"}</SheetTitle>
                <SheetDescription>
                  Received {formatDateTime(selected.created_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <Badge
                    variant={statusColor(selected.status)}
                    className="capitalize"
                  >
                    {selected.status}
                  </Badge>
                </div>

                <DetailField label="Email" value={selected.email} />
                <DetailField label="Phone" value={selected.phone} />
                <DetailField
                  label="Topic"
                  value={
                    selected.topic
                      ? selected.topic.charAt(0).toUpperCase() +
                        selected.topic.slice(1)
                      : null
                  }
                />
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">Message</p>
                  <p className="whitespace-pre-wrap rounded-xl border border-border/80 bg-muted/30 p-3 text-sm leading-relaxed">
                    {selected.message || "—"}
                  </p>
                </div>
              </div>

              <SheetFooter className="border-t border-border">
                {selected.status === "new" ? (
                  <Button
                    disabled={acting}
                    onClick={() =>
                      void setEnquiryStatus(selected.id, "contacted")
                    }
                  >
                    {acting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CheckCircle className="size-4" />
                    )}
                    Mark contacted
                  </Button>
                ) : null}
                {selected.status !== "closed" ? (
                  <Button
                    variant="outline"
                    disabled={acting}
                    onClick={() => void setEnquiryStatus(selected.id, "closed")}
                  >
                    <XCircle className="size-4" />
                    Close enquiry
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    disabled={acting}
                    onClick={() => void setEnquiryStatus(selected.id, "new")}
                  >
                    Reopen
                  </Button>
                )}
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}
