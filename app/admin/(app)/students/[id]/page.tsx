"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  PageSectionTitle,
  Panel,
} from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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

type StudentProfile = {
  phone: string | null;
  whatsapp: string | null;
  alternate_phone: string | null;
  location: string | null;
  address_line: string | null;
  city_state: string | null;
  pin_code: string | null;
  date_of_birth: string | null;
  gender: string | null;
  membership_tier: string | null;
  program_label: string | null;
  highest_qualification: string | null;
  profession: string | null;
  medical_background: string | null;
  registration_no: string | null;
  currently_working: boolean | null;
  guardian_name: string | null;
  weekly_goal_hours: number | null;
};

type Treatment = {
  id: string;
  treatment_name: string;
  sort_order: number;
  hands_on_included: boolean;
  current_stage: string | null;
  completed_at: string | null;
};

type Enrollment = {
  id: string;
  title: string;
  course_id: string | null;
  course_title: string | null;
  status: string;
  origin: string;
  progress_pct: number | null;
  agreed_price: number | null;
  currency: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  treatments: Treatment[];
};

type StudentDetail = {
  id: string;
  email: string | null;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  profile: StudentProfile | null;
  enrollments: Enrollment[];
  active_enrollments: Enrollment[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ProfileField({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  let display = "—";
  if (typeof value === "boolean") display = value ? "Yes" : "No";
  else if (value != null && value !== "") display = String(value);

  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium break-words">{display}</dd>
    </div>
  );
}

export default function AdminStudentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<StudentDetail>(`/api/admin/students/${id}`);
      setStudent(res.data);
      const firstActive = res.data.active_enrollments[0]?.id;
      if (firstActive) setExpandedId(firstActive);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load student"
          : "Failed to load student",
      );
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive() {
    if (!student) return;
    setToggling(true);
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
      setToggling(false);
    }
  }

  if (loading && !student) {
    return (
      <div>
        <PageHeader title="Student" description="Loading…" />
        <Panel className="p-6">
          <EmptyState message="Loading student…" />
        </Panel>
      </div>
    );
  }

  if (!student) {
    return (
      <div>
        <PageHeader title="Student" description="Not found" />
        <Panel className="p-6">
          <EmptyState message="Student not found." />
          <div className="mt-4">
            <Link
              href="/admin/students"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex gap-1.5",
              )}
            >
              <ArrowLeft className="size-4" />
              Back to students
            </Link>
          </div>
        </Panel>
      </div>
    );
  }

  const profile = student.profile;

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.full_name}
        description={student.email || "No email on file"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/students"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "inline-flex gap-1.5",
              )}
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            <Button
              variant={student.is_active ? "outline" : "default"}
              disabled={toggling}
              onClick={() => void toggleActive()}
            >
              {toggling
                ? "Updating…"
                : student.is_active
                  ? "Deactivate"
                  : "Activate"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={student.is_active ? "secondary" : "outline"}>
          {student.is_active ? "Active" : "Inactive"}
        </Badge>
        {student.display_name ? (
          <span className="text-sm text-muted-foreground">
            Display: {student.display_name}
          </span>
        ) : null}
      </div>

      <Panel className="p-5 md:p-6">
        <PageSectionTitle title="Account activity" />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ProfileField label="Created" value={formatDate(student.created_at)} />
          <ProfileField
            label="Last login"
            value={formatDate(student.last_login_at)}
          />
          <ProfileField
            label="Active pathways"
            value={student.active_enrollments.length}
          />
          <ProfileField
            label="Total enrollments"
            value={student.enrollments.length}
          />
        </dl>
      </Panel>

      <Panel className="p-5 md:p-6">
        <PageSectionTitle title="Profile" />
        {!profile ? (
          <div className="-mx-1">
            <EmptyState message="No student profile on file yet." />
          </div>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ProfileField label="Phone" value={profile.phone} />
            <ProfileField label="WhatsApp" value={profile.whatsapp} />
            <ProfileField
              label="Alternate phone"
              value={profile.alternate_phone}
            />
            <ProfileField label="Location" value={profile.location} />
            <ProfileField label="Address" value={profile.address_line} />
            <ProfileField label="City / state" value={profile.city_state} />
            <ProfileField label="PIN" value={profile.pin_code} />
            <ProfileField
              label="Date of birth"
              value={formatDate(profile.date_of_birth)}
            />
            <ProfileField label="Gender" value={profile.gender} />
            <ProfileField
              label="Membership"
              value={profile.membership_tier}
            />
            <ProfileField label="Program" value={profile.program_label} />
            <ProfileField
              label="Qualification"
              value={profile.highest_qualification}
            />
            <ProfileField label="Profession" value={profile.profession} />
            <ProfileField
              label="Medical background"
              value={profile.medical_background}
            />
            <ProfileField
              label="Registration no."
              value={profile.registration_no}
            />
            <ProfileField
              label="Currently working"
              value={profile.currently_working}
            />
            <ProfileField label="Guardian" value={profile.guardian_name} />
            <ProfileField
              label="Weekly goal (hrs)"
              value={profile.weekly_goal_hours}
            />
          </dl>
        )}
      </Panel>

      <Panel className="p-5 md:p-6">
        <PageSectionTitle title="Currently doing" />
        {!student.active_enrollments.length ? (
          <EmptyState message="No active course right now." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {student.active_enrollments.map((e) => (
              <div
                key={e.id}
                className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/enrollments/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.course_title || e.title}
                    </Link>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Started {formatDate(e.started_at)} · Progress{" "}
                      {e.progress_pct ?? 0}%
                    </p>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {e.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel className="p-5 md:p-6">
        <PageSectionTitle title="Purchased / all pathways" />
        {!student.enrollments.length ? (
          <EmptyState message="No enrollments yet." />
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course / pathway</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.enrollments.map((e) => {
                  const open = expandedId === e.id;
                  return (
                    <Fragment key={e.id}>
                      <TableRow>
                        <TableCell>
                          <Link
                            href={`/admin/enrollments/${e.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {e.course_title || e.title}
                          </Link>
                          <div className="text-xs text-muted-foreground capitalize">
                            {e.origin}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              e.status === "active" ? "secondary" : "outline"
                            }
                            className="capitalize"
                          >
                            {e.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{e.progress_pct ?? 0}%</TableCell>
                        <TableCell>
                          {e.agreed_price != null
                            ? `${e.currency} ${e.agreed_price}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div>Created {formatDate(e.created_at)}</div>
                          <div>Started {formatDate(e.started_at)}</div>
                          {e.completed_at ? (
                            <div>Completed {formatDate(e.completed_at)}</div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedId(open ? null : e.id)
                            }
                          >
                            {open ? "Hide treatments" : "Treatments"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            {!e.treatments.length ? (
                              <p className="text-sm text-muted-foreground">
                                No treatments on this pathway.
                              </p>
                            ) : (
                              <ul className="space-y-2 py-1">
                                {e.treatments.map((t) => (
                                  <li
                                    key={t.id}
                                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                                  >
                                    <span>
                                      {t.sort_order + 1}. {t.treatment_name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Stage: {t.current_stage || "—"}
                                      {t.hands_on_included
                                        ? ""
                                        : " · no hands-on"}
                                      {t.completed_at
                                        ? ` · done ${formatDate(t.completed_at)}`
                                        : ""}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
