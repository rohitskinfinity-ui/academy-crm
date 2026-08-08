"use client";

import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function fileNameFromUrl(url: string) {
  try {
    return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "file");
  } catch {
    return "file";
  }
}

function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);
}

function isPdfUrl(url: string) {
  return /\.pdf(\?|$)/i.test(url);
}

export function AttachmentPreviewLink({
  url,
  label,
  className,
}: {
  url: string;
  label: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = fileNameFromUrl(url);
  const image = isImageUrl(url);
  const pdf = isPdfUrl(url);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex flex-col items-start gap-0.5 text-left text-teal-700 hover:underline"
        }
      >
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-6">{name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/30 p-2">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={name}
                className="mx-auto max-h-[65vh] w-auto max-w-full object-contain"
              />
            ) : pdf ? (
              <iframe
                title={name}
                src={url}
                className="h-[65vh] w-full rounded-md bg-white"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted-foreground">
                <p>Preview is not available for this file type.</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-teal-700 hover:underline"
                >
                  Open in new tab <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                globalThis.open(url, "_blank", "noopener,noreferrer")
              }
            >
              <ExternalLink className="size-3.5" />
              Open original
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
