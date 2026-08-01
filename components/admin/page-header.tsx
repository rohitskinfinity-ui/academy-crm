"use client";

import type { ReactNode } from "react";
import { useAdminPageHeader } from "@/hooks/use-admin-page-header";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  useAdminPageHeader({ title, description, actions });
  return null;
}

/** In-page section title (not duplicated in top bar). */
export function PageSectionTitle({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mb-4 text-base font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      {title}
    </h2>
  );
}

export function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_1px_2px_rgb(10_10_11_/_4%),0_8px_24px_-12px_rgb(10_10_11_/_8%)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <span className="size-1.5 rounded-full bg-primary" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
