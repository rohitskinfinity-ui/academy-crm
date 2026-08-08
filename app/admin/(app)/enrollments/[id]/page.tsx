"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { RegistrationApplicationPanel } from "@/components/admin/registration-application-panel";
import { EnrollmentCertificatePanel } from "@/components/admin/enrollment-certificate-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, adminPatch, adminPut } from "@/lib/api/admin-client";
import { ReferralCodeField } from "@/components/admin/referral-code-field";

type EnrollmentDetail = {
  id: string;
  title: string;
  status: string;
  origin: string;
  type?: "course" | "workshop";
  agreed_price: number | null;
  currency: string;
  payment_type?: string | null;
  amount_paid?: number | null;
  remaining_amount?: number | null;
  user_full_name?: string;
  user_email?: string;
  course_title?: string;
  workshop_title?: string | null;
  notes_internal?: string | null;
  referral_code?: string | null;
  referrer_first_name?: string | null;
  friend_discount?: number | null;
  referral_currency?: string | null;
  referral_credit_applied?: number | null;
  student_wallet?: {
    available: number;
    earned: number;
    redeemed: number;
    currency: string;
  } | null;
  application?: Record<string, unknown> | null;
  payments?: Array<{
    id: string;
    txn_code: string;
    amount: number;
    currency: string;
    status: string;
    payment_option: string | null;
    description: string | null;
    paid_at: string | null;
    created_at: string;
  }>;
  treatments: Array<{
    id: string;
    treatment_id: string;
    treatment_name: string;
    hands_on_included: boolean;
    current_stage: string;
  }>;
};

function formatMoney(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${currency} ${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

type TreatmentOption = { id: string; name: string };

export default function EnrollmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [allTreatments, setAllTreatments] = useState<TreatmentOption[]>([]);
  const [selected, setSelected] = useState<
    Array<{ treatment_id: string; hands_on_included: boolean }>
  >([]);
  const [meta, setMeta] = useState({
    title: "",
    status: "active",
    agreed_price: "",
    notes_internal: "",
    referral_code: "",
  });

  const load = useCallback(async () => {
    try {
      const [enr, treatments] = await Promise.all([
        adminGet<EnrollmentDetail>(`/api/admin/enrollments/${id}`),
        adminGet<{ items: TreatmentOption[] }>("/api/admin/treatments", {
          limit: 100,
        }),
      ]);
      setEnrollment(enr.data);
      setAllTreatments(treatments.data.items ?? []);
      setSelected(
        (enr.data.treatments ?? []).map((t) => ({
          treatment_id: t.treatment_id,
          hands_on_included: t.hands_on_included,
        })),
      );
      setMeta({
        title: enr.data.title,
        status: enr.data.status,
        agreed_price: enr.data.agreed_price?.toString() ?? "",
        notes_internal: enr.data.notes_internal ?? "",
        referral_code: enr.data.referral_code ?? "",
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load"
          : "Failed to load",
      );
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMeta(e: FormEvent) {
    e.preventDefault();
    try {
      await adminPatch(`/api/admin/enrollments/${id}`, {
        title: meta.title,
        status: meta.status,
        agreed_price: meta.agreed_price ? Number(meta.agreed_price) : null,
        notes_internal: meta.notes_internal || null,
        referral_code: meta.referral_code.trim() || null,
      });
      toast.success("Enrollment updated");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    }
  }

  function toggleTreatment(treatmentId: string) {
    setSelected((prev) => {
      const exists = prev.find((p) => p.treatment_id === treatmentId);
      if (exists) return prev.filter((p) => p.treatment_id !== treatmentId);
      return [...prev, { treatment_id: treatmentId, hands_on_included: true }];
    });
  }

  async function saveTreatments() {
    try {
      await adminPut(`/api/admin/enrollments/${id}/treatments`, {
        treatments: selected.map((t, i) => ({
          treatment_id: t.treatment_id,
          sort_order: i,
          hands_on_included: t.hands_on_included,
        })),
        agreed_price: meta.agreed_price ? Number(meta.agreed_price) : null,
      });
      toast.success("Pathway updated");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    }
  }

  if (!enrollment) return <EmptyState message="Loading enrollment…" />;

  return (
    <div>
      <Link
        href="/admin/enrollments"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to enrollments
      </Link>

      <PageHeader
        title={enrollment.title}
        description={`${enrollment.user_full_name ?? "Student"} · ${enrollment.origin}`}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{enrollment.status}</Badge>
        {enrollment.type === "workshop" || enrollment.workshop_title ? (
          <Badge
            variant="outline"
            className="border-teal-200 bg-teal-50 text-teal-800"
          >
            Workshop
          </Badge>
        ) : (
          <Badge variant="outline">Course</Badge>
        )}
        {(enrollment.workshop_title || enrollment.course_title) && (
          <Badge variant="outline">
            {enrollment.workshop_title || enrollment.course_title}
          </Badge>
        )}
        {enrollment.payment_type ? (
          <Badge variant="outline" className="capitalize">
            Payment: {enrollment.payment_type}
          </Badge>
        ) : null}
        <Badge
          variant="outline"
          className={
            (enrollment.remaining_amount ?? 0) > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }
        >
          {(enrollment.remaining_amount ?? 0) > 0 ? "Balance due" : "Paid"}
        </Badge>
      </div>

      <Panel className="mb-6 p-5">
        <h3 className="mb-4 font-semibold">Payment</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Agreed price</p>
            <p className="text-sm font-medium">
              {formatMoney(enrollment.currency, enrollment.agreed_price)}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Amount paid</p>
            <p className="text-sm font-medium">
              {formatMoney(enrollment.currency, enrollment.amount_paid ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-sm font-medium">
              {enrollment.remaining_amount != null
                ? formatMoney(enrollment.currency, enrollment.remaining_amount)
                : "—"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Referral code</p>
            <p className="text-sm font-medium">
              {enrollment.referral_code || "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Referred by</p>
            <p className="text-sm font-medium">
              {enrollment.referrer_first_name || "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">Friend discount</p>
            <p className="text-sm font-medium">
              {enrollment.friend_discount != null
                ? formatMoney(
                    enrollment.referral_currency || enrollment.currency,
                    enrollment.friend_discount,
                  )
                : "—"}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Referral credit used
            </p>
            <p className="text-sm font-medium">
              {enrollment.referral_credit_applied
                ? formatMoney(
                    enrollment.currency,
                    enrollment.referral_credit_applied,
                  )
                : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              Student wallet remaining
            </p>
            <p className="text-sm font-medium">
              {enrollment.student_wallet
                ? formatMoney(
                    enrollment.student_wallet.currency || enrollment.currency,
                    enrollment.student_wallet.available,
                  )
                : "—"}
            </p>
          </div>
        </div>
        {enrollment.payments && enrollment.payments.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Payment history
            </p>
            {enrollment.payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {formatMoney(p.currency || enrollment.currency, p.amount)}
                    {p.payment_option ? (
                      <span className="ml-1.5 text-xs capitalize text-muted-foreground">
                        · {p.payment_option}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.txn_code}
                    {p.description ? ` · ${p.description}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p className="capitalize">{p.status}</p>
                  <p>
                    {p.paid_at || p.created_at
                      ? new Date(p.paid_at || p.created_at).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No payment records yet.
          </p>
        )}
      </Panel>

      <div className="mb-6">
        <EnrollmentCertificatePanel enrollmentId={id} />
      </div>

      {enrollment.application ? (
        <div className="mb-6">
          <RegistrationApplicationPanel
            application={
              enrollment.application as Parameters<
                typeof RegistrationApplicationPanel
              >[0]["application"]
            }
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-5">
          <h3 className="mb-4 font-semibold">Details</h3>
          <form onSubmit={saveMeta} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={meta.title}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, title: e.target.value }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="h-9 w-full rounded-lg border border-input px-2.5 text-sm"
                  value={meta.status}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, status: e.target.value }))
                  }
                >
                  <option value="active">active</option>
                  <option value="completed">completed</option>
                  <option value="suspended">suspended</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Agreed price</Label>
                <Input
                  type="number"
                  value={meta.agreed_price}
                  onChange={(e) =>
                    setMeta((m) => ({ ...m, agreed_price: e.target.value }))
                  }
                />
              </div>
            </div>
            <ReferralCodeField
              value={meta.referral_code}
              onChange={(referral_code) =>
                setMeta((m) => ({ ...m, referral_code }))
              }
            />
            <div className="space-y-2">
              <Label>Internal notes</Label>
              <Input
                value={meta.notes_internal}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, notes_internal: e.target.value }))
                }
              />
            </div>
            <Button type="submit">Save details</Button>
          </form>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Custom treatments</h3>
            <Button size="sm" onClick={() => void saveTreatments()}>
              Save pathway
            </Button>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-auto">
            {allTreatments.map((t) => {
              const item = selected.find((s) => s.treatment_id === t.id);
              const checked = Boolean(item);
              return (
                <div
                  key={t.id}
                  className="rounded-lg border border-border px-3 py-2.5"
                >
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTreatment(t.id)}
                      className="size-4"
                    />
                    <span className="text-sm font-medium">{t.name}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
