"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import axios from "axios";
import { CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/api/admin-client";

type FileUploadProps = {
  treatmentId: string;
  category: "image" | "videos" | "booklets" | "thumbnails";
  stage?: string;
  accept?: string;
  label?: string;
  value?: string | null;
  onChange: (data: {
    url: string;
    path: string;
    name: string;
    size_bytes?: number;
    mime_type?: string;
  }) => void;
  onClear?: () => void;
};

function formatFileName(urlOrPath: string): string {
  if (!urlOrPath) return "";
  let name = decodeURIComponent(urlOrPath.split("/").pop() || urlOrPath);
  // Strip leading numeric timestamp prefix if present e.g. "1785261496353_"
  name = name.replace(/^\d{10,}_/, "");
  return name;
}

export function GcpFileUpload({
  treatmentId,
  category,
  stage = "theory",
  accept,
  label = "Upload file",
  value,
  onChange,
  onClear,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const cleanFileName = value ? formatFileName(value) : "";

  async function handleFileSelect(file: File) {
    if (!file) return;
    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("treatmentId", treatmentId || "general");
      formData.append("category", category);
      formData.append("stage", stage);

      const token = getAdminToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await axios.post("/api/admin/upload", formData, {
        headers,
        onUploadProgress: (evt) => {
          if (evt.total) {
            const pct = Math.round((evt.loaded * 100) / evt.total);
            setProgress(pct);
          }
        },
      });

      if (res.data?.data) {
        toast.success("File uploaded successfully");
        onChange(res.data.data);
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Upload failed"
          : "Upload failed",
      );
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void handleFileSelect(file);
    }
  }

  return (
    <div className="space-y-2 w-full max-w-full overflow-hidden">
      {label && <p className="text-xs font-medium text-muted-foreground">{label}</p>}

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-2.5 text-sm w-full max-w-full overflow-hidden">
          <div className="flex items-center gap-2 min-w-0 max-w-[calc(100%-2.5rem)]">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              title={value}
              className="truncate text-xs font-medium text-foreground hover:underline max-w-[200px] sm:max-w-[280px] block"
            >
              {cleanFileName}
            </a>
          </div>
          {onClear && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onClear}
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-lg border border-dashed p-4 text-center transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-input hover:border-primary/50"
          }`}
        >
          <input
            type="file"
            accept={accept}
            onChange={onInputChange}
            disabled={uploading}
            className="absolute inset-0 cursor-pointer opacity-0"
          />

          {uploading ? (
            <div className="flex flex-col items-center justify-center space-y-2 py-2">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs font-medium text-muted-foreground">
                Uploading file... {progress}%
              </p>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-1 py-1">
              <UploadCloud className="size-7 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">
                Click or drag file to upload
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
