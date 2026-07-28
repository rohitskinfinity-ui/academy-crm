"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/store/admin-auth";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrate = useAdminAuth((s) => s.hydrate);
  const hydrated = useAdminAuth((s) => s.hydrated);
  const token = useAdminAuth((s) => s.token);
  const loading = useAdminAuth((s) => s.loading);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/admin/login");
    }
  }, [hydrated, token, router]);

  if (!hydrated || loading || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-pulse rounded-full bg-foreground/15" />
          <p className="text-sm text-muted-foreground">Loading admin…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
