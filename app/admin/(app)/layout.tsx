"use client";

import { AdminAuthGuard } from "@/components/admin/auth-guard";
import { AdminSidebar } from "@/components/admin/sidebar";
import { AdminTopbar } from "@/components/admin/topbar";

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthGuard>
      <div className="flex h-dvh overflow-hidden bg-background">
        <AdminSidebar />
        <div className="crm-shell-bg flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopbar />
          <main className="min-h-0 flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>
    </AdminAuthGuard>
  );
}
