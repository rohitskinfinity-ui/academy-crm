"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Award, Loader2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, adminPatch, adminPost, adminPut } from "@/lib/api/admin-client";

type EnrollmentDetail = {
  id: string;
  title: string;
  status: string;
  origin: string;
  agreed_price: number | null;
  currency: string;
  user_full_name?: string;
  user_email?: string;
  course_title?: string;
  notes_internal?: string | null;
  treatments: Array<{
    id: string;
    treatment_id: string;
    treatment_name: string;
    hands_on_included: boolean;
    current_stage: string;
  }>;
};

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
  });
  const [completion, setCompletion] = useState<{
    eligible: boolean;
    progress_pct: number;
    blockers: string[];
    live: { pct: number; met: boolean };
    hands_on: { attended: number; required_days: number; met: boolean };
  } | null>(null);
  const [certificate, setCertificate] = useState<{
    certificate_code: string;
    issued_at: string;
  } | null>(null);
  const [issuingCert, setIssuingCert] = useState(false);

  const load = useCallback(async () => {
    try {
      const [enr, treatments, certRes] = await Promise.all([
        adminGet<EnrollmentDetail>(`/api/admin/enrollments/${id}`),
        adminGet<{ items: TreatmentOption[] }>("/api/admin/treatments", {
          limit: 100,
        }),
        adminGet<{
          completion: typeof completion;
          certificate: typeof certificate;
        }>(`/api/admin/enrollments/${id}/certificate`).catch(() => null),
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
      });
      if (certRes?.data) {
        setCompletion(certRes.data.completion);
        setCertificate(certRes.data.certificate);
      }
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

  function toggleHandsOn(treatmentId: string) {
    setSelected((prev) =>
      prev.map((p) =>
        p.treatment_id === treatmentId
          ? { ...p, hands_on_included: !p.hands_on_included }
          : p,
      ),
    );
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

  async function issueCertificate() {
    setIssuingCert(true);
    try {
      const res = await adminPost<{ certificate_code: string; issued_at: string }>(
        `/api/admin/enrollments/${id}/certificate`,
        {},
      );
      toast.success(`Certificate issued: ${res.data.certificate_code}`);
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Certificate issuance failed"
          : "Certificate issuance failed",
      );
    } finally {
      setIssuingCert(false);
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
        {enrollment.course_title && (
          <Badge variant="outline">{enrollment.course_title}</Badge>
        )}
        {completion && (
          <Badge variant={completion.eligible ? "default" : "outline"}>
            {completion.progress_pct}% ·{" "}
            {completion.eligible ? "Eligible for PGDCC" : "Not eligible"}
          </Badge>
        )}
      </div>

      {completion && (
        <Panel className="mb-6 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Award className="size-4" />
                PGDCC completion & certificate
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Live attendance: {completion.live.pct}% · Hands-on:{" "}
                {completion.hands_on.attended}/{completion.hands_on.required_days}{" "}
                days
              </p>
              {!completion.eligible && completion.blockers.length > 0 && (
                <ul className="mt-2 text-xs text-muted-foreground list-disc pl-4">
                  {completion.blockers.slice(0, 5).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {certificate && (
                <p className="mt-2 text-sm font-medium text-emerald-700">
                  Issued: {certificate.certificate_code} on{" "}
                  {new Date(certificate.issued_at).toLocaleDateString("en-IN")}
                </p>
              )}
            </div>
            {!certificate && (
              <Button
                disabled={!completion.eligible || issuingCert}
                onClick={() => void issueCertificate()}
              >
                {issuingCert && (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                )}
                Issue PGDCC certificate
              </Button>
            )}
          </div>
        </Panel>
      )}

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
                  {checked && (
                    <label className="mt-2 ml-7 flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={item?.hands_on_included ?? true}
                        onChange={() => toggleHandsOn(t.id)}
                      />
                      Hands-on included
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
