"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { GcpFileUpload } from "@/components/admin/gcp-file-upload";
import { RichTextEditor } from "@/components/admin/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminGet, adminPatch } from "@/lib/api/admin-client";
import {
  COURSE_DELIVERY_MODES,
  COURSE_DELIVERY_MODE_LABELS,
  type CourseDeliveryMode,
} from "@/lib/courseDeliveryModes";

type Procedure = {
  name: string;
  image_url?: string | null;
  sort_order: number;
};

type Workshop = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  eligibility_html: string | null;
  image_url: string | null;
  starts_on: string;
  ends_on: string | null;
  duration_label: string | null;
  locations: string | null;
  delivery_modes: string[] | null;
  features: string[] | string | null;
  procedures: Procedure[] | string | null;
  seats_total: number | null;
  seats_left: number | null;
  price: string | number | null;
  currency: string;
  contact_phone: string | null;
  status: string;
  is_published: boolean;
  sort_order: number;
};

function parseJsonArray<T>(value: unknown, fallback: T[]): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminWorkshopDetailPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";

  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    tagline: "",
    description: "",
    eligibility_html: "",
    image_url: "",
    starts_on: "",
    ends_on: "",
    duration_label: "",
    locations: "",
    delivery_modes: [] as CourseDeliveryMode[],
    featuresText: "",
    procedures: [] as Procedure[],
    seats_total: "",
    seats_left: "",
    price: "",
    currency: "INR",
    contact_phone: "",
    status: "draft",
    is_published: false,
    sort_order: "0",
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await adminGet<Workshop>(`/api/admin/workshops/${id}`);
      const w = res.data;
      setWorkshop(w);
      const modes = (w.delivery_modes ?? []).filter((m): m is CourseDeliveryMode =>
        (COURSE_DELIVERY_MODES as readonly string[]).includes(m),
      );
      const features = parseJsonArray<string>(w.features, []);
      const procedures = parseJsonArray<Procedure>(w.procedures, []).map(
        (p, i) => ({
          name: p.name || "",
          image_url: p.image_url ?? null,
          sort_order: p.sort_order ?? i,
        }),
      );
      setForm({
        title: w.title ?? "",
        slug: w.slug ?? "",
        tagline: w.tagline ?? "",
        description: w.description ?? "",
        eligibility_html: w.eligibility_html ?? "",
        image_url: w.image_url ?? "",
        starts_on: w.starts_on?.slice(0, 10) ?? "",
        ends_on: w.ends_on?.slice(0, 10) ?? "",
        duration_label: w.duration_label ?? "",
        locations: w.locations ?? "",
        delivery_modes: modes,
        featuresText: features.join("\n"),
        procedures,
        seats_total: w.seats_total != null ? String(w.seats_total) : "",
        seats_left: w.seats_left != null ? String(w.seats_left) : "",
        price: w.price != null ? String(w.price) : "",
        currency: w.currency || "INR",
        contact_phone: w.contact_phone ?? "",
        status: w.status || "draft",
        is_published: !!w.is_published,
        sort_order: String(w.sort_order ?? 0),
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load workshop"
          : "Failed to load workshop",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleMode(mode: CourseDeliveryMode) {
    setForm((f) => ({
      ...f,
      delivery_modes: f.delivery_modes.includes(mode)
        ? f.delivery_modes.filter((m) => m !== mode)
        : [...f.delivery_modes, mode],
    }));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const features = form.featuresText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      await adminPatch(`/api/admin/workshops/${id}`, {
        title: form.title,
        slug: form.slug || slugify(form.title),
        tagline: form.tagline || null,
        description: form.description || null,
        eligibility_html: form.eligibility_html || null,
        image_url: form.image_url || null,
        starts_on: form.starts_on,
        ends_on: form.ends_on || null,
        duration_label: form.duration_label || null,
        locations: form.locations || null,
        delivery_modes: form.delivery_modes,
        features,
        procedures: form.procedures.map((p, i) => ({
          name: p.name,
          image_url: p.image_url || null,
          sort_order: i,
        })),
        seats_total: form.seats_total ? Number(form.seats_total) : null,
        seats_left: form.seats_left ? Number(form.seats_left) : null,
        price: form.price ? Number(form.price) : null,
        currency: form.currency || "INR",
        contact_phone: form.contact_phone || null,
        status: form.status,
        is_published: form.status === "published" ? true : form.is_published,
        sort_order: Number(form.sort_order) || 0,
      });
      toast.success("Workshop saved");
      await load();
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

  if (loading) return <EmptyState message="Loading workshop…" />;
  if (!workshop) return <EmptyState message="Workshop not found" />;

  return (
    <div>
      <Link
        href="/admin/workshops"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to workshops
      </Link>

      <PageHeader
        title={workshop.title}
        description="Offline workshop — not linked to any course."
        actions={
          <Badge variant={form.status === "published" ? "default" : "secondary"}>
            {form.status}
          </Badge>
        }
      />

      <form onSubmit={onSave} className="grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4 p-5">
          <h3 className="font-semibold">Basics</h3>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              required
              value={form.title}
              onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({
                  ...f,
                  title,
                  slug: f.slug || slugify(title),
                }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              required
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Tagline</Label>
            <Input
              value={form.tagline}
              onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              placeholder="Real Patients. Real Procedures. Real Confidence."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input
                type="date"
                required
                value={form.starts_on}
                onChange={(e) =>
                  setForm((f) => ({ ...f, starts_on: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input
                type="date"
                value={form.ends_on}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ends_on: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Duration label</Label>
              <Input
                value={form.duration_label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, duration_label: e.target.value }))
                }
                placeholder="5 Days"
              />
            </div>
            <div className="space-y-2">
              <Label>Locations</Label>
              <Input
                value={form.locations}
                onChange={(e) =>
                  setForm((f) => ({ ...f, locations: e.target.value }))
                }
                placeholder="Noida | Gurugram"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Seats total</Label>
              <Input
                type="number"
                min={0}
                value={form.seats_total}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seats_total: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Seats left</Label>
              <Input
                type="number"
                min={0}
                value={form.seats_left}
                onChange={(e) =>
                  setForm((f) => ({ ...f, seats_left: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Price (INR)</Label>
              <Input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contact phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
                placeholder="+91 …"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value,
                    is_published: e.target.value === "published",
                  }))
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Banner / flyer image</Label>
            <GcpFileUpload
              treatmentId={id}
              category="image"
              scope="workshops"
              bucket="public"
              stage="banner"
              accept="image/*"
              label="Upload workshop banner"
              value={form.image_url || null}
              onChange={(data) =>
                setForm((f) => ({ ...f, image_url: data.url }))
              }
              onClear={() => setForm((f) => ({ ...f, image_url: "" }))}
            />
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="space-y-4 p-5">
            <h3 className="font-semibold">Copy</h3>
            <div className="space-y-2">
              <Label>Description</Label>
              <RichTextEditor
                value={form.description}
                onChange={(html) =>
                  setForm((f) => ({ ...f, description: html }))
                }
                placeholder="Workshop overview…"
                minHeightClassName="min-h-[140px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Eligibility</Label>
              <RichTextEditor
                value={form.eligibility_html}
                onChange={(html) =>
                  setForm((f) => ({ ...f, eligibility_html: html }))
                }
                placeholder="MBBS | MD …"
                minHeightClassName="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Features (one per line)</Label>
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={form.featuresText}
                onChange={(e) =>
                  setForm((f) => ({ ...f, featuresText: e.target.value }))
                }
                placeholder={"Real Patient Cases\nHands-On Training\nExpert Mentorship"}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery modes</Label>
              <div className="flex flex-wrap gap-3">
                {COURSE_DELIVERY_MODES.map((mode) => (
                  <label
                    key={mode}
                    className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={form.delivery_modes.includes(mode)}
                      onChange={() => toggleMode(mode)}
                      className="size-3.5 rounded"
                    />
                    {COURSE_DELIVERY_MODE_LABELS[mode]}
                  </label>
                ))}
              </div>
            </div>
          </Panel>

          <Panel className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Procedures</h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    procedures: [
                      ...f.procedures,
                      {
                        name: "",
                        image_url: null,
                        sort_order: f.procedures.length,
                      },
                    ],
                  }))
                }
              >
                <Plus className="size-3.5" />
                Add
              </Button>
            </div>
            {form.procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Optional procedure cards (Botox, Fillers, …).
              </p>
            ) : (
              <div className="space-y-3">
                {form.procedures.map((proc, index) => (
                  <div
                    key={index}
                    className="space-y-2 rounded-xl border border-border/80 p-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        placeholder="Procedure name"
                        value={proc.name}
                        onChange={(e) =>
                          setForm((f) => {
                            const next = [...f.procedures];
                            next[index] = {
                              ...next[index],
                              name: e.target.value,
                            };
                            return { ...f, procedures: next };
                          })
                        }
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        disabled={index === 0}
                        onClick={() =>
                          setForm((f) => {
                            const next = [...f.procedures];
                            const [item] = next.splice(index, 1);
                            next.splice(index - 1, 0, item);
                            return { ...f, procedures: next };
                          })
                        }
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        disabled={index === form.procedures.length - 1}
                        onClick={() =>
                          setForm((f) => {
                            const next = [...f.procedures];
                            const [item] = next.splice(index, 1);
                            next.splice(index + 1, 0, item);
                            return { ...f, procedures: next };
                          })
                        }
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            procedures: f.procedures.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <GcpFileUpload
                      treatmentId={id}
                      category="image"
                      scope="workshops"
                      bucket="public"
                      stage="procedures"
                      accept="image/*"
                      label="Procedure image"
                      value={proc.image_url || null}
                      onChange={(data) =>
                        setForm((f) => {
                          const next = [...f.procedures];
                          next[index] = {
                            ...next[index],
                            image_url: data.url,
                          };
                          return { ...f, procedures: next };
                        })
                      }
                      onClear={() =>
                        setForm((f) => {
                          const next = [...f.procedures];
                          next[index] = {
                            ...next[index],
                            image_url: null,
                          };
                          return { ...f, procedures: next };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-1.5 size-4 animate-spin" />}
            Save workshop
          </Button>
        </div>
      </form>
    </div>
  );
}
