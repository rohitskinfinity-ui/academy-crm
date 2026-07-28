"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/treatments": "Treatments",
  "/admin/courses": "Courses",
  "/admin/enrollments": "Enrollments",
};

function resolveTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin/treatments/")) return "Treatment detail";
  if (pathname.startsWith("/admin/courses/")) return "Course detail";
  if (pathname.startsWith("/admin/enrollments/")) return "Enrollment detail";
  return "Admin";
}

export function AdminTopbar({ title }: { title?: string }) {
  const pathname = usePathname();
  const heading = title ?? resolveTitle(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-card/70 px-6 backdrop-blur-sm">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Skinfinity Academy
        </p>
        <h1 className="text-lg font-semibold tracking-tight">{heading}</h1>
      </div>
    </header>
  );
}
