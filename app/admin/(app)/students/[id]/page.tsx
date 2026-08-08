"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
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
import { adminGet, adminPatch } from "@/lib/api/admin-client";
import { RegistrationApplicationPanel } from "@/components/admin/registration-application-panel";
import { EnrollmentCertificatePanel } from "@/components/admin/enrollment-certificate-panel";
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
  workshop_id?: string | null;
  workshop_title?: string | null;
  type?: "course" | "workshop";
  payment_type?: string | null;
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

type RegistrationApplication = {
  id: string;
  registration_id: string | null;
  full_name: string;
  guardian_name: string | null;
  course_preference: string | null;
  course_title: string | null;
  workshop_title: string | null;
  application_kind: string | null;
  date_of_birth: string | null;
  gender: string | null;
  highest_qualification: string | null;
  profession: string | null;
  medical_background: string | null;
  registration_no: string | null;
  currently_working: string | null;
  whatsapp: string | null;
  alternate_no: string | null;
  email: string;
  address: string | null;
  city_state: string | null;
  pin_code: string | null;
  source: string | null;
  quoted_price: number | string | null;
  currency: string | null;
  photo_url: string | null;
  document_url: string | null;
  status: string | null;
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
  applications?: RegistrationApplication[];
};

type FormState = {
  full_name: string;
  display_name: string;
  email: string;
  is_active: boolean;
  phone: string;
  whatsapp: string;
  alternate_phone: string;
  location: string;
  address_line: string;
  city_state: string;
  pin_code: string;
  date_of_birth: string;
  gender: string;
  highest_qualification: string;
  profession: string;
  medical_background: string;
  registration_no: string;
  guardian_name: string;
  program_label: string;
};

function emptyForm(): FormState {
  return {
    full_name: "",
    display_name: "",
    email: "",
    is_active: true,
    phone: "",
    whatsapp: "",
    alternate_phone: "",
    location: "",
    address_line: "",
    city_state: "",
    pin_code: "",
    date_of_birth: "",
    gender: "",
    highest_qualification: "",
    profession: "",
    medical_background: "",
    registration_no: "",
    guardian_name: "",
    program_label: "",
  };
}

function formFromStudent(student: StudentDetail): FormState {
  const p = student.profile;
  return {
    full_name: student.full_name || "",
    display_name: student.display_name || "",
    email: student.email || "",
    is_active: student.is_active,
    phone: p?.phone || "",
    whatsapp: p?.whatsapp || "",
    alternate_phone: p?.alternate_phone || "",
    location: p?.location || "",
    address_line: p?.address_line || "",
    city_state: p?.city_state || "",
    pin_code: p?.pin_code || "",
    date_of_birth: p?.date_of_birth
      ? String(p.date_of_birth).slice(0, 10)
      : "",
    gender: p?.gender || "",
    highest_qualification: p?.highest_qualification || "",
    profession: p?.profession || "",
    medical_background: p?.medical_background || "",
    registration_no: p?.registration_no || "",
    guardian_name: p?.guardian_name || "",
    program_label: p?.program_label || "",
  };
}

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
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<StudentDetail>(`/api/admin/students/${id}`);
      setStudent(res.data);
      setForm(formFromStudent(res.data));
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

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!student) return;
    setSaving(true);
    try {
      const res = await adminPatch<StudentDetail>(
        `/api/admin/students/${student.id}`,
        {
          full_name: form.full_name.trim(),
          display_name: form.display_name.trim() || null,
          email: form.email.trim().toLowerCase(),
          is_active: form.is_active,
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          alternate_phone: form.alternate_phone.trim() || null,
          location: form.location.trim() || null,
          address_line: form.address_line.trim() || null,
          city_state: form.city_state.trim() || null,
          pin_code: form.pin_code.trim() || null,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender.trim() || null,
          highest_qualification: form.highest_qualification.trim() || null,
          profession: form.profession.trim() || null,
          medical_background: form.medical_background.trim() || null,
          registration_no: form.registration_no.trim() || null,
          guardian_name: form.guardian_name.trim() || null,
          program_label: form.program_label.trim() || null,
        },
      );
      setStudent(res.data);
      setForm(formFromStudent(res.data));
      toast.success("Student details saved");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title={student.full_name}
        description={student.email || "No email on file"}
        actions={
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
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={student.is_active ? "secondary" : "outline"}>
          {student.is_active ? "Active" : "Inactive"}
        </Badge>
        <span className="text-sm text-muted-foreground">{student.email || "—"}</span>
      </div>

      <Panel className="p-5 md:p-6">
        <PageSectionTitle title="Edit student details" />
        <form onSubmit={onSave} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                required
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Must match the Google account used for student login.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                value={form.whatsapp}
                onChange={(e) =>
                  setForm((f) => ({ ...f, whatsapp: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alternate_phone">Alternate phone</Label>
              <Input
                id="alternate_phone"
                value={form.alternate_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, alternate_phone: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guardian_name">Guardian</Label>
              <Input
                id="guardian_name"
                value={form.guardian_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, guardian_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city_state">City / state</Label>
              <Input
                id="city_state"
                value={form.city_state}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city_state: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address_line">Address</Label>
              <Input
                id="address_line"
                value={form.address_line}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address_line: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin_code">PIN</Label>
              <Input
                id="pin_code"
                value={form.pin_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pin_code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_of_birth">Date of birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) =>
                  setForm((f) => ({ ...f, date_of_birth: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <select
                id="gender"
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={form.gender}
                onChange={(e) =>
                  setForm((f) => ({ ...f, gender: e.target.value }))
                }
              >
                <option value="">—</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="program_label">Program label</Label>
              <Input
                id="program_label"
                value={form.program_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, program_label: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highest_qualification">Qualification</Label>
              <Input
                id="highest_qualification"
                value={form.highest_qualification}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    highest_qualification: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profession">Profession</Label>
              <Input
                id="profession"
                value={form.profession}
                onChange={(e) =>
                  setForm((f) => ({ ...f, profession: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration_no">Registration no.</Label>
              <Input
                id="registration_no"
                value={form.registration_no}
                onChange={(e) =>
                  setForm((f) => ({ ...f, registration_no: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="medical_background">Medical background</Label>
              <Input
                id="medical_background"
                value={form.medical_background}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    medical_background: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="is_active">Account status</Label>
              <select
                id="is_active"
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                value={form.is_active ? "true" : "false"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    is_active: e.target.value === "true",
                  }))
                }
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setForm(formFromStudent(student))}
            >
              Reset
            </Button>
          </div>
        </form>
      </Panel>

      {(student.applications ?? []).length > 0 ? (
        <div className="space-y-4">
          <PageSectionTitle title="Registration applications" />
          {(student.applications ?? []).map((app, index) => (
            <RegistrationApplicationPanel
              key={app.id}
              application={app}
              defaultOpen={index === 0}
              title={
                app.application_kind === "workshop"
                  ? "Workshop registration"
                  : "Course registration"
              }
            />
          ))}
        </div>
      ) : null}

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
                      {e.course_title || e.workshop_title || e.title}
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
                {e.course_id || e.workshop_id ? (
                  <div className="mt-3 border-t border-border/60 pt-3">
                    <EnrollmentCertificatePanel enrollmentId={e.id} compact />
                  </div>
                ) : null}
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
                            {e.course_title || e.workshop_title || e.title}
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
                            {open
                              ? "Hide"
                              : e.course_id || e.workshop_id
                                ? "Certificate / treatments"
                                : "Treatments"}
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow>
                          <TableCell colSpan={6} className="bg-muted/30">
                            <div className="space-y-4 py-1">
                              {e.course_id || e.workshop_id ? (
                                <EnrollmentCertificatePanel
                                  enrollmentId={e.id}
                                  compact
                                />
                              ) : null}
                              {!e.treatments.length ? (
                                <p className="text-sm text-muted-foreground">
                                  No treatments on this pathway.
                                </p>
                              ) : (
                                <ul className="space-y-2">
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
                            </div>
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
