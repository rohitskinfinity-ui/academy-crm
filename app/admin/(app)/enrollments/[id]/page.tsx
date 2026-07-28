"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, adminPatch, adminPut } from "@/lib/api/admin-client";

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
      </div>

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
