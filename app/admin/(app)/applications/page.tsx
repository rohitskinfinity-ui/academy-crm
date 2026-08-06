"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import {
  Eye,
  GraduationCap,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Search,
} from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
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
import { adminGet, adminPatch, adminPost } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

const STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "converted",
  "lost",
  "closed",
  "spam",
] as const;

/** Manual status picks — conversion is done via "Convert after payment". */
const EDITABLE_STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "lost",
  "closed",
  "spam",
] as const;

type Enquiry = {
  id: string;
  lead_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  topic: string | null;
  message: string | null;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  enrollment_id: string | null;
  converted_at: string | null;
  channel: string | null;
  course_id?: string | null;
  workshop_id?: string | null;
  program_title?: string | null;
  program_type?: "course" | "workshop" | null;
  created_at: string;
  updated_at?: string | null;
  application?: {
    id?: string;
    registration_id?: string | null;
    full_name?: string | null;
    guardian_name?: string | null;
    course_preference?: string | null;
    course_id?: string | null;
    workshop_id?: string | null;
    course_title?: string | null;
    workshop_title?: string | null;
    application_kind?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    highest_qualification?: string | null;
    profession?: string | null;
    medical_background?: string | null;
    registration_no?: string | null;
    currently_working?: string | null;
    whatsapp?: string | null;
    alternate_no?: string | null;
    email?: string | null;
    address?: string | null;
    city_state?: string | null;
    pin_code?: string | null;
    source?: string | null;
    quoted_price?: number | string | null;
    currency?: string | null;
    photo_url?: string | null;
    document_url?: string | null;
    status?: string | null;
  } | null;
  comments?: Array<{
    id: string;
    body: string;
    created_at: string;
    author_name?: string | null;
  }>;
  history?: Array<{
    id: string;
    action: string;
    from_value: string | null;
    to_value: string | null;
    created_at: string;
    actor_name?: string | null;
  }>;
};

type Paginated = {
  items: Enquiry[];
  pagination: { total: number; total_pages: number; page: number };
};

type StaffOption = { id: string; full_name: string; email: string | null };
type CourseOption = { id: string; title: string };
type WorkshopOption = { id: string; title: string };

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
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
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
    case "follow_up":
      return {
        variant: "default",
        className: "bg-amber-600 text-white hover:bg-amber-600",
      };
    case "converted":
      return {
        variant: "default",
        className: "bg-emerald-700 text-white hover:bg-emerald-700",
      };
    case "lost":
      return { variant: "destructive" };
    case "closed":
      return { variant: "outline", className: "text-muted-foreground" };
    case "spam":
      return { variant: "destructive" };
    default:
      return { variant: "outline" };
  }
}

function topicLabel(topic: string | null) {
  if (!topic) return null;
  if (topic.startsWith("Workshop:")) return topic.replace(/^Workshop:\s*/, "");
  if (topic.startsWith("Course:")) return topic.replace(/^Course:\s*/, "");
  return titleCase(topic);
}

export default function AdminApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Enquiry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [comment, setComment] = useState("");
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
    payment_type: "full" as "advance" | "full",
    course_id: "",
    workshop_id: "",
    agreed_price: "",
    amount_paid: "",
  });

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

  useEffect(() => {
    void (async () => {
      try {
        const [admins, staffUsers, c, w] = await Promise.all([
          adminGet<{ items: Array<StaffOption & { role?: string }> }>(
            "/api/admin/users",
            { role: "admin", limit: 100 },
          ),
          adminGet<{ items: Array<StaffOption & { role?: string }> }>(
            "/api/admin/users",
            { role: "staff", limit: 100 },
          ),
          adminGet<{ items: CourseOption[] }>("/api/admin/courses", {
            limit: 100,
          }),
          adminGet<{ items: WorkshopOption[] }>("/api/admin/workshops", {
            limit: 100,
          }),
        ]);
        const byId = new Map<string, StaffOption>();
        for (const x of [
          ...(admins.data.items ?? []),
          ...(staffUsers.data.items ?? []),
        ]) {
          byId.set(x.id, x);
        }
        setStaff([...byId.values()]);
        setCourses(c.data.items ?? []);
        setWorkshops(w.data.items ?? []);
      } catch {
        /* options optional */
      }
    })();
  }, []);

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    setComment("");
    setConvertOpen(false);
    try {
      const res = await adminGet<Enquiry>(`/api/admin/applications/${id}`);
      setDetail(res.data);
      {
        const workshopId =
          res.data.workshop_id ||
          res.data.application?.workshop_id ||
          "";
        const courseId =
          workshopId
            ? ""
            : res.data.course_id ||
              res.data.application?.course_id ||
              "";
        setConvertForm({
          payment_type: "full",
          course_id: courseId,
          workshop_id: workshopId,
          agreed_price:
            res.data.application?.quoted_price != null
              ? String(res.data.application.quoted_price)
              : "",
          amount_paid: "",
        });
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load enquiry"
          : "Failed to load enquiry",
      );
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail() {
    if (!selectedId) return;
    const res = await adminGet<Enquiry>(
      `/api/admin/applications/${selectedId}`,
    );
    setDetail(res.data);
    await load();
  }

  async function patchEnquiry(body: {
    status?: string;
    assigned_to?: string | null;
  }) {
    if (!selectedId) return;
    setActing(true);
    try {
      await adminPatch(`/api/admin/applications/${selectedId}`, body);
      toast.success("Enquiry updated");
      await refreshDetail();
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

  async function submitComment() {
    if (!selectedId || !comment.trim()) return;
    setActing(true);
    try {
      await adminPost(`/api/admin/applications/${selectedId}/comments`, {
        body: comment.trim(),
      });
      setComment("");
      toast.success("Comment added");
      await refreshDetail();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Comment failed"
          : "Comment failed",
      );
    } finally {
      setActing(false);
    }
  }

  async function convertEnquiry() {
    if (!selectedId) return;
    if (!convertForm.course_id && !convertForm.workshop_id) {
      toast.error("Select a course or workshop");
      return;
    }
    setActing(true);
    try {
      const res = await adminPost<{
        enrollment: { id: string };
      }>(`/api/admin/applications/${selectedId}/convert`, {
        payment_type: convertForm.payment_type,
        course_id: convertForm.workshop_id
          ? null
          : convertForm.course_id || null,
        workshop_id: convertForm.workshop_id || null,
        agreed_price: convertForm.agreed_price
          ? Number(convertForm.agreed_price)
          : null,
        amount_paid: convertForm.amount_paid
          ? Number(convertForm.amount_paid)
          : null,
      });
      toast.success("Converted — student + enrollment created");
      setConvertOpen(false);
      await refreshDetail();
      if (res.data?.enrollment?.id) {
        window.location.href = `/admin/enrollments/${res.data.enrollment.id}`;
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Convert failed"
          : "Convert failed",
      );
    } finally {
      setActing(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Enquiries"
        description="Lead management — assign, follow up, comment, and convert after QR payment."
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
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {titleCase(s)}
            </option>
          ))}
        </select>
      </Panel>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={["Contact", "Topic", "Status", "Assigned", "Received", ""]}
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
                <TableHead className="h-11 px-4">Assigned</TableHead>
                <TableHead className="h-11 px-4">Received</TableHead>
                <TableHead className="h-11 w-20 px-4 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((row) => {
                const badge = statusBadgeProps(row.status);
                const isWorkshop = row.topic?.startsWith("Workshop:");
                const isCourse = row.topic?.startsWith("Course:");
                return (
                  <TableRow
                    key={row.id}
                    className="h-14 cursor-pointer"
                    onClick={() => void openDetail(row.id)}
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
                        <div className="flex flex-col gap-1">
                          {isWorkshop || isCourse ? (
                            <span
                              className={cn(
                                "inline-flex w-fit rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                isWorkshop
                                  ? "bg-teal-50 text-teal-700"
                                  : "bg-sky-50 text-sky-700",
                              )}
                            >
                              {isWorkshop ? "Workshop" : "Course"}
                            </span>
                          ) : null}
                          <span className="inline-flex rounded-md bg-muted/70 px-2 py-0.5 text-xs font-medium text-foreground">
                            {topicLabel(row.topic)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <Badge
                        variant={badge.variant}
                        className={cn("capitalize", badge.className)}
                      >
                        {titleCase(row.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-sm text-muted-foreground">
                      {row.assignee_name || "Unassigned"}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-sm whitespace-nowrap text-muted-foreground tabular-nums">
                      {formatShortDate(row.created_at)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="View enquiry"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDetail(row.id);
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
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null);
            setDetail(null);
            setConvertOpen(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col sm:max-w-xl"
        >
          {detailLoading && !detail ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <>
              <SheetHeader className="border-b border-border pr-10">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>{detail.full_name || "Enquiry"}</SheetTitle>
                  <Badge
                    variant={statusBadgeProps(detail.status).variant}
                    className={cn(
                      "capitalize",
                      statusBadgeProps(detail.status).className,
                    )}
                  >
                    {titleCase(detail.status)}
                  </Badge>
                </div>
                <SheetDescription>
                  Received {formatDateTime(detail.created_at)}
                  {detail.channel ? ` · ${detail.channel}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
                <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
                  <ContactLine
                    icon={<Mail className="size-3.5" />}
                    label="Email"
                    value={detail.email}
                    href={
                      detail.email ? `mailto:${detail.email}` : undefined
                    }
                  />
                  <ContactLine
                    icon={<Phone className="size-3.5" />}
                    label="Phone"
                    value={detail.phone}
                    href={detail.phone ? `tel:${detail.phone}` : undefined}
                  />
                </div>

                <DetailField
                  label="Topic / Program"
                  value={
                    detail.program_title || topicLabel(detail.topic) || "—"
                  }
                />

                {detail.application ? (
                  <div className="space-y-4 rounded-xl border border-border/80 bg-card p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Registration form
                      </p>
                      {detail.application.registration_id ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          {detail.application.registration_id}
                        </span>
                      ) : null}
                    </div>

                    <SectionBlock title="Personal details">
                      <DetailField
                        label="Full name"
                        value={detail.application.full_name}
                      />
                      <DetailField
                        label="Father's / Husband's name"
                        value={detail.application.guardian_name}
                      />
                      <DetailField
                        label={
                          detail.application.application_kind === "workshop"
                            ? "Workshop"
                            : "Course"
                        }
                        value={
                          detail.application.workshop_title ||
                          detail.application.course_title ||
                          detail.application.course_preference
                        }
                      />
                      <DetailField
                        label="Date of birth"
                        value={
                          detail.application.date_of_birth
                            ? formatShortDate(
                                String(detail.application.date_of_birth),
                              )
                            : null
                        }
                      />
                      <DetailField
                        label="Gender"
                        value={titleCase(detail.application.gender)}
                      />
                      <DetailField
                        label="Photo"
                        value={
                          detail.application.photo_url ? (
                            <a
                              href={detail.application.photo_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:underline"
                            >
                              View photo
                            </a>
                          ) : (
                            "—"
                          )
                        }
                      />
                    </SectionBlock>

                    <SectionBlock title="Education & profession">
                      <DetailField
                        label="Highest qualification"
                        value={detail.application.highest_qualification}
                      />
                      <DetailField
                        label="Profession"
                        value={detail.application.profession}
                      />
                      <DetailField
                        label="Qualification document"
                        value={
                          detail.application.document_url ? (
                            <a
                              href={detail.application.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-teal-700 hover:underline"
                            >
                              View document
                            </a>
                          ) : (
                            "—"
                          )
                        }
                      />
                    </SectionBlock>

                    <SectionBlock title="Medical / declaration">
                      <DetailField
                        label="Medical background"
                        value={titleCase(
                          detail.application.medical_background,
                        )}
                      />
                      <DetailField
                        label="Registration no"
                        value={detail.application.registration_no}
                      />
                      <DetailField
                        label="Currently working"
                        value={titleCase(
                          detail.application.currently_working,
                        )}
                      />
                    </SectionBlock>

                    <SectionBlock title="Contact details">
                      <DetailField
                        label="WhatsApp"
                        value={detail.application.whatsapp}
                      />
                      <DetailField
                        label="Alternate no"
                        value={detail.application.alternate_no}
                      />
                      <DetailField
                        label="Email"
                        value={detail.application.email}
                      />
                      <DetailField
                        label="Address"
                        value={detail.application.address}
                      />
                      <DetailField
                        label="City / State"
                        value={detail.application.city_state}
                      />
                      <DetailField
                        label="PIN code"
                        value={detail.application.pin_code}
                      />
                    </SectionBlock>

                    <SectionBlock title="Other">
                      <DetailField
                        label="How did you find us?"
                        value={detail.application.source}
                      />
                      <DetailField
                        label="Quoted fee"
                        value={
                          detail.application.quoted_price != null
                            ? `${detail.application.currency || "INR"} ${detail.application.quoted_price}`
                            : null
                        }
                      />
                    </SectionBlock>
                  </div>
                ) : (
                  <div>
                    <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Message
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl border border-border/80 bg-card p-3.5 text-sm leading-relaxed">
                      {detail.message || "—"}
                    </p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                      disabled={acting || detail.status === "converted"}
                      value={detail.status}
                      onChange={(e) =>
                        void patchEnquiry({ status: e.target.value })
                      }
                    >
                      {detail.status === "converted" ? (
                        <option value="converted">Converted</option>
                      ) : null}
                      {EDITABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {titleCase(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Assign to</Label>
                    <select
                      className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                      disabled={acting || detail.status === "converted"}
                      value={detail.assigned_to || ""}
                      onChange={(e) =>
                        void patchEnquiry({
                          assigned_to: e.target.value || null,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name}
                          {s.email ? ` (${s.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {detail.status !== "converted" ? (
                  <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3.5">
                    {!convertOpen ? (
                      <Button
                        className="w-full"
                        disabled={acting}
                        onClick={() => setConvertOpen(true)}
                      >
                        <GraduationCap className="size-4" />
                        Convert after payment
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-teal-900">
                          Confirm QR payment → create student + enrollment
                        </p>
                        <div className="space-y-1.5">
                          <Label>Payment type</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                            value={convertForm.payment_type}
                            onChange={(e) =>
                              setConvertForm((f) => ({
                                ...f,
                                payment_type: e.target.value as
                                  | "advance"
                                  | "full",
                              }))
                            }
                          >
                            <option value="advance">Advance</option>
                            <option value="full">Full payment</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Course</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                            value={convertForm.course_id}
                            onChange={(e) =>
                              setConvertForm((f) => ({
                                ...f,
                                course_id: e.target.value,
                                workshop_id: "",
                              }))
                            }
                          >
                            <option value="">—</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Or workshop</Label>
                          <select
                            className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                            value={convertForm.workshop_id}
                            onChange={(e) =>
                              setConvertForm((f) => ({
                                ...f,
                                workshop_id: e.target.value,
                                course_id: "",
                              }))
                            }
                          >
                            <option value="">—</option>
                            {workshops.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1.5">
                            <Label>Agreed price</Label>
                            <Input
                              type="number"
                              value={convertForm.agreed_price}
                              onChange={(e) =>
                                setConvertForm((f) => ({
                                  ...f,
                                  agreed_price: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Amount paid</Label>
                            <Input
                              type="number"
                              value={convertForm.amount_paid}
                              onChange={(e) =>
                                setConvertForm((f) => ({
                                  ...f,
                                  amount_paid: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            className="flex-1"
                            disabled={acting}
                            onClick={() => setConvertOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={acting}
                            onClick={() => void convertEnquiry()}
                          >
                            {acting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            Confirm convert
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : detail.enrollment_id ? (
                  <Link
                    href={`/admin/enrollments/${detail.enrollment_id}`}
                    className="inline-flex h-9 w-full items-center justify-center rounded-lg border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                  >
                    Open enrollment
                  </Link>
                ) : null}

                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <MessageSquare className="size-3.5 text-muted-foreground" />
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Comments
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(detail.comments ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No comments yet.
                      </p>
                    ) : (
                      (detail.comments ?? []).map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg border border-border/80 bg-card p-3 text-sm"
                        >
                          <p className="whitespace-pre-wrap">{c.body}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {c.author_name || "Staff"} ·{" "}
                            {formatDateTime(c.created_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 space-y-2">
                    <Textarea
                      placeholder="Add a comment…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                    />
                    <Button
                      size="sm"
                      disabled={acting || !comment.trim()}
                      onClick={() => void submitComment()}
                    >
                      Add comment
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    History
                  </p>
                  <div className="space-y-2">
                    {(detail.history ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No history yet.
                      </p>
                    ) : (
                      (detail.history ?? []).map((h) => (
                        <div
                          key={h.id}
                          className="rounded-lg border border-border/60 px-3 py-2 text-xs"
                        >
                          <p className="font-medium capitalize">
                            {h.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-muted-foreground">
                            {h.from_value || h.to_value
                              ? `${h.from_value ?? "—"} → ${h.to_value ?? "—"}`
                              : null}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {h.actor_name || "System"} ·{" "}
                            {formatDateTime(h.created_at)}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
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
  value: ReactNode;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <div className="text-sm font-medium break-words">{value || "—"}</div>
    </div>
  );
}

function SectionBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2.5 border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-700">
        {title}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>
    </div>
  );
}
