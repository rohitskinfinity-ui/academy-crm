"use client";

import { useLayoutEffect } from "react";
import type { ReactNode } from "react";
import { useAdminPageHeaderStore } from "@/store/admin-page-header";

/** Sync page title / actions into the fixed admin top bar. */
export function useAdminPageHeader(opts: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const setHeader = useAdminPageHeaderStore((s) => s.setHeader);
  const resetHeader = useAdminPageHeaderStore((s) => s.resetHeader);

  useLayoutEffect(() => {
    setHeader({
      title: opts.title,
      description: opts.description ?? null,
      actions: opts.actions ?? null,
    });
    return () => resetHeader();
  }, [opts.title, opts.description, opts.actions, setHeader, resetHeader]);
}
