"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAdminAuth } from "@/store/admin-auth";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrate = useAdminAuth((s) => s.hydrate);
  const hydrated = useAdminAuth((s) => s.hydrated);
  const token = useAdminAuth((s) => s.token);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/admin/login");
    }
  }, [hydrated, token, router]);

  // Only wait for localStorage hydrate — not the slow /auth/me round-trip.
  if (!hydrated || !token) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2
            className="size-7 animate-spin text-primary"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">Loading admin…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
