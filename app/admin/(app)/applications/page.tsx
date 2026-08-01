"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle,
  Eye,
  Loader2,
  Mail,
  Phone,
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
import { cn } from "@/lib/utils";

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

function titleCase(value: string | null | undefined) {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadgeProps(status: string): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
} {
  switch (status) {
    case "new":
      return {
        variant: "default",
        className: "bg-sky-700 text-white hover:bg-sky-700",
      };
    case "contacted":
      return { variant: "secondary" };
    case "closed":
      return { variant: "outline", className: "text-muted-foreground" };
    case "spam":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
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

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Contact-form enquiries from the website. Course purchases go straight to Enrollments."
      />

      <Panel className="mb-4 flex flex-wrap items-center gap-3 p-3.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone, topic…"
            className="h-9 pl-9"
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
          headers={["Contact", "Topic", "Status", "Received", ""]}
          reservedOffset={340}
        />
      ) : !data?.items.length ? (
        <Panel>
          <EmptyState message="No enquiries yet." />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4">Contact</TableHead>
                <TableHead className="h-11 px-4">Topic</TableHead>
                <TableHead className="h-11 px-4">Status</TableHead>
                <TableHead className="h-11 px-4">Received</TableHead>
                <TableHead className="h-11 w-20 px-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => {
                const badge = statusBadgeProps(row.status);
                return (
                  <TableRow
                    key={row.id}
                    className="h-14 cursor-pointer"
                    onClick={() => setSelected(row)}
                  >
                    <TableCell className="px-4 py-2.5">
                      <p className="font-medium text-foreground">
                        {row.full_name || "—"}
                      </p>
                      <div className="mt-0.5 flex max-w-[280px] flex-col gap-0.5 text-xs text-muted-foreground">
                        {row.email ? (
                          <span className="truncate" title={row.email}>
                            {row.email}
                          </span>
                        ) : null}
                        {row.phone ? (
                          <span className="truncate tabular-nums">
                            {row.phone}
                          </span>
                        ) : !row.email ? (
                          <span>—</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      {row.topic ? (
                        <span className="inline-flex rounded-md bg-muted/70 px-2 py-0.5 text-xs font-medium text-foreground capitalize">
                          {row.topic}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge
                        variant={badge.variant}
                        className={cn("capitalize", badge.className)}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatShortDate(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="View enquiry"
                        title="View"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected(row);
                        }}
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
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
        </Panel>
      )}

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
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{selected.full_name || "Enquiry"}</SheetTitle>
                  <Badge
                    variant={statusBadgeProps(selected.status).variant}
                    className={cn(
                      "capitalize",
                      statusBadgeProps(selected.status).className,
                    )}
                  >
                    {selected.status}
                  </Badge>
                </div>
                <SheetDescription>
                  Received {formatDateTime(selected.created_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                  <ContactLine
                    icon={<Mail className="size-3.5" />}
                    label="Email"
                    value={selected.email}
                    href={
                      selected.email ? `mailto:${selected.email}` : undefined
                    }
                  />
                  <ContactLine
                    icon={<Phone className="size-3.5" />}
                    label="Phone"
                    value={selected.phone}
                    href={
                      selected.phone ? `tel:${selected.phone}` : undefined
                    }
                  />
                </div>

                <DetailField label="Topic" value={titleCase(selected.topic)} />

                <div>
                  <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Message
                  </p>
                  <p className="whitespace-pre-wrap rounded-xl border border-border/80 bg-card p-3.5 text-sm leading-relaxed">
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

function ContactLine({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {value && href ? (
          <a
            href={href}
            className="block truncate text-sm font-medium text-foreground hover:text-primary"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-medium">{value || "—"}</p>
        )}
      </div>
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
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="text-sm font-medium break-words">{value || "—"}</p>
    </div>
  );
}
