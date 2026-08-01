"use client";

import { usePathname } from "next/navigation";
import { useAdminPageHeaderStore } from "@/store/admin-page-header";

const TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/users": "User management",
  "/admin/students": "Students",
  "/admin/treatments": "Treatments",
  "/admin/courses": "Courses",
  "/admin/enrollments": "Enrollments",
  "/admin/applications": "Applications",
  "/admin/live-classes": "Live Classes",
};

function resolveTitle(pathname: string) {
  if (TITLES[pathname]) return TITLES[pathname];
  if (pathname.startsWith("/admin/students/")) return "Student detail";
  if (pathname.startsWith("/admin/users/")) return "User detail";
  if (pathname.startsWith("/admin/treatments/")) return "Treatment detail";
  if (pathname.startsWith("/admin/courses/")) return "Course detail";
  if (pathname.startsWith("/admin/enrollments/")) return "Enrollment detail";
  return "Admin";
}

export function AdminTopbar() {
  const pathname = usePathname();
  const title = useAdminPageHeaderStore((s) => s.title);
  const description = useAdminPageHeaderStore((s) => s.description);
  const actions = useAdminPageHeaderStore((s) => s.actions);

  const heading = title ?? resolveTitle(pathname);

  return (
    <header className="sticky top-0 z-10 flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-card/75 px-6 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/65">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          {heading}
        </h1>
        {description ? (
          <p className="mt-0.5 line-clamp-2 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
