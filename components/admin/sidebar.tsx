"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Newspaper,
  Syringe,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import { BrandLogo } from "@/components/admin/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdminAuth } from "@/store/admin-auth";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "User management", icon: Users },
  { href: "/admin/students", label: "Students", icon: UserRound },
  { href: "/admin/treatments", label: "Treatments", icon: Syringe },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/enrollments", label: "Enrollments", icon: GraduationCap },
  { href: "/admin/applications", label: "Enquiries", icon: ClipboardList },
  { href: "/admin/blog", label: "Blog", icon: Newspaper },
  { href: "/admin/live-classes", label: "Live Classes", icon: Video },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const admin = useAdminAuth((s) => s.admin);
  const logout = useAdminAuth((s) => s.logout);

  async function onLogout() {
    await logout();
    router.replace("/admin/login");
  }

  return (
    <aside className="relative flex h-full w-[260px] shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(255_255_255_/_6%),_transparent_55%)]"
      />

      <div className="relative shrink-0 border-b border-sidebar-border px-5 py-5">
        <BrandLogo size={44} showWordmark />
      </div>

      <nav className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/35">
          Workspace
        </p>
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-white/[0.08] hover:text-sidebar-foreground",
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white"
                />
              ) : null}
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg transition-colors",
                  active
                    ? "bg-white text-brand-teal"
                    : "bg-white/[0.08] text-sidebar-foreground/90 group-hover:bg-white/[0.12]",
                )}
              >
                <Icon className="size-3.5" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="relative shrink-0 border-t border-sidebar-border p-4">
        <div className="mb-3 rounded-xl bg-white/[0.04] px-3 py-2.5">
          <p className="truncate text-sm font-medium tracking-tight">
            {admin?.full_name ?? "Admin"}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/45">
            {admin?.email}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full border-white/10 bg-transparent text-sidebar-foreground hover:bg-white/10 hover:text-white"
          onClick={() => void onLogout()}
        >
          <LogOut className="size-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
