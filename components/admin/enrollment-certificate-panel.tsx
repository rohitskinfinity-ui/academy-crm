"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { FileText, Loader2, UploadCloud } from "lucide-react";
import { EmptyState, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminGet, adminPostForm } from "@/lib/api/admin-client";

type CertificateRow = {
  id: string;
  title: string;
  recipient_name: string | null;
  certificate_code: string;
  grade: string | null;
  pdf_url: string | null;
  issued_at: string;
};

type CertEligibility = {
  eligible: boolean;
  progress_pct: number;
  progress_met: boolean;
  quiz_published: boolean;
  quiz_pass_percent: number | null;
  quiz_best_percent: number | null;
  quiz_passed: boolean;
  blockers: string[];
};

type CertPayload = {
  completion: {
    progress_pct: number;
    cert_eligibility?: CertEligibility;
  };
  certificate: CertificateRow | null;
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

export function EnrollmentCertificatePanel({
  enrollmentId,
  compact = false,
}: {
  enrollmentId: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [data, setData] = useState<CertPayload | null>(null);
  const [preview, setPreview] = useState<{
    open: boolean;
    loading: boolean;
    url: string | null;
    issued: boolean;
    content_type: string | null;
  }>({
    open: false,
    loading: false,
    url: null,
    issued: false,
    content_type: null,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<CertPayload>(
        `/api/admin/enrollments/${enrollmentId}/certificate`,
      );
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load certificate"
          : "Failed to load certificate",
      );
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibility = data?.completion.cert_eligibility;
  const cert = data?.certificate ?? null;
  const isPdfPreview =
    preview.content_type === "application/pdf" ||
    Boolean(preview.content_type?.includes("pdf"));

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await adminPostForm(
        `/api/admin/enrollments/${enrollmentId}/certificate`,
        form,
      );
      toast.success(cert ? "Certificate replaced" : "Certificate uploaded");
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Upload failed"
          : "Upload failed",
      );
    } finally {
      setUploading(false);
    }
  }

  async function openPreview() {
    setPreview({
      open: true,
      loading: true,
      url: null,
      issued: Boolean(cert?.pdf_url),
      content_type: null,
    });
    try {
      const res = await adminGet<{
        url: string;
        issued: boolean;
        content_type?: string;
      }>(`/api/admin/enrollments/${enrollmentId}/certificate/preview`);
      setPreview({
        open: true,
        loading: false,
        url: res.data.url,
        issued: res.data.issued,
        content_type: res.data.content_type ?? null,
      });
    } catch (err) {
      setPreview((p) => ({ ...p, open: false, loading: false }));
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Preview failed"
          : "Preview failed",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="size-4 animate-spin" />
        Loading certificate…
      </div>
    );
  }

  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">
          Progress {Math.round(eligibility?.progress_pct ?? data?.completion.progress_pct ?? 0)}%
          {eligibility?.progress_met ? " · 90% met" : " · need 90%"}
        </Badge>
        <Badge variant="outline">
          Quiz{" "}
          {eligibility?.quiz_best_percent != null
            ? `${Math.round(eligibility.quiz_best_percent)}%`
            : "not taken"}
          {eligibility?.quiz_pass_percent != null
            ? ` / ${eligibility.quiz_pass_percent}%`
            : " / 75%"}
          {eligibility?.quiz_passed ? " · passed" : ""}
        </Badge>
        {cert?.pdf_url ? (
          <Badge className="bg-emerald-600">Uploaded</Badge>
        ) : (
          <Badge variant="secondary">No file yet</Badge>
        )}
      </div>

      {cert ? (
        <div className="text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Code:</span>{" "}
            <span className="font-medium">{cert.certificate_code}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Recipient:</span>{" "}
            {cert.recipient_name || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Issued:</span>{" "}
            {formatDate(cert.issued_at)}
            {cert.grade ? ` · Grade ${cert.grade}` : ""}
          </p>
        </div>
      ) : (
        <EmptyState message="Upload a PDF or image for this student. They can download it in LMS after 90% progress and a 75% quiz pass." />
      )}

      {eligibility?.blockers?.length && !eligibility.eligible ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          LMS download still locked: {eligibility.blockers[0]}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void openPreview()}>
          <FileText className="size-3.5" />
          Preview
        </Button>
        <label
          className={cn(
            buttonVariants({ size: "sm" }),
            uploading && "pointer-events-none opacity-50",
            "cursor-pointer",
          )}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <UploadCloud className="size-3.5" />
          )}
          {cert?.pdf_url ? "Replace file" : "Upload certificate"}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={onFileChange}
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );

  return (
    <>
      {compact ? (
        body
      ) : (
        <Panel className="p-5 space-y-3">
          <h3 className="font-semibold">Certificate</h3>
          {body}
        </Panel>
      )}

      <Dialog
        open={preview.open}
        onOpenChange={(open) =>
          setPreview((p) => ({ ...p, open, url: open ? p.url : null }))
        }
      >
        <DialogContent
          className={cn(
            "flex flex-col gap-2 p-3",
            isPdfPreview
              ? "sm:max-w-5xl h-[min(92vh,1000px)]"
              : "w-auto max-w-[calc(100vw-1.5rem)] sm:max-w-none max-h-[96vh]",
          )}
        >
          <DialogHeader>
            <DialogTitle>
              Certificate preview
              {preview.issued ? "" : " · draft watermark"}
            </DialogTitle>
          </DialogHeader>
          <div
            className={cn(
              "overflow-hidden rounded-lg border bg-white",
              isPdfPreview ? "min-h-0 flex-1" : "leading-none",
            )}
          >
            {preview.loading ? (
              <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading…
              </div>
            ) : preview.url ? (
              isPdfPreview ? (
                <iframe
                  src={preview.url}
                  className="size-full min-h-[70vh] border-0 bg-white"
                  title="Certificate preview"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt="Certificate"
                  className="mx-auto block h-[min(88vh,1100px)] w-auto max-w-[calc(100vw-3rem)] object-contain"
                />
              )
            ) : (
              <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                Preview unavailable.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
