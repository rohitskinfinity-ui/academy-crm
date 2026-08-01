"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  GraduationCap,
  Syringe,
  Users,
} from "lucide-react";
import { AdminTableSkeletonCompact } from "@/components/admin/table-skeleton";
import { EmptyState, PageHeader, PageSectionTitle, Panel } from "@/components/admin/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { adminGet } from "@/lib/api/admin-client";

type Paginated<T> = {
  items: T[];
  pagination: { total: number };
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    users: 0,
    treatments: 0,
    courses: 0,
    enrollments: 0,
  });
  const [recent, setRecent] = useState<
    Array<{
      id: string;
      title: string;
      status: string;
      user_full_name?: string;
      created_at?: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [users, treatments, courses, enrollments] = await Promise.all([
          adminGet<Paginated<unknown>>("/api/admin/users", { limit: 1 }),
          adminGet<Paginated<unknown>>("/api/admin/treatments", { limit: 1 }),
          adminGet<Paginated<unknown>>("/api/admin/courses", { limit: 1 }),
          adminGet<Paginated<{
            id: string;
            title: string;
            status: string;
            user_full_name?: string;
            created_at?: string;
          }>>("/api/admin/enrollments", { limit: 8 }),
        ]);
        setStats({
          users: users.data.pagination.total,
          treatments: treatments.data.pagination.total,
          courses: courses.data.pagination.total,
          enrollments: enrollments.data.pagination.total,
        });
        setRecent(enrollments.data.items ?? []);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const cards = [
    { label: "Users", value: stats.users, href: "/admin/users", icon: Users },
    {
      label: "Treatments",
      value: stats.treatments,
      href: "/admin/treatments",
      icon: Syringe,
    },
    {
      label: "Courses",
      value: stats.courses,
      href: "/admin/courses",
      icon: BookOpen,
    },
    {
      label: "Enrollments",
      value: stats.enrollments,
      href: "/admin/enrollments",
      icon: GraduationCap,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Snapshot of your LMS catalog and student pathways."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href}>
              <Panel className="p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgb(10_10_11_/_18%)]">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {card.label}
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                      {loading ? "—" : card.value}
                    </p>
                  </div>
                  <div className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-sm">
                    <Icon className="size-4" />
                  </div>
                </div>
              </Panel>
            </Link>
          );
        })}
      </div>

      <PageSectionTitle title="Recent enrollments" />
      {loading ? (
        <AdminTableSkeletonCompact
          headers={["Title", "Student", "Status"]}
          rows={6}
        />
      ) : recent.length === 0 ? (
        <Panel>
          <EmptyState message="No enrollments yet. Create one to get started." />
        </Panel>
      ) : (
      <Panel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      href={`/admin/enrollments/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.user_full_name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </Panel>
      )}
    </div>
  );
}
