"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, GraduationCap, Trash2 } from "lucide-react";
import { EmptyState, PageHeader, Panel } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminDelete, adminGet, adminPatch } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type UserDetail = {
  id: string;
  email: string | null;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  phone: string | null;
  enrollment_count: number;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const ROLES = ["student", "instructor", "staff", "admin"] as const;

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    display_name: "",
    email: "",
    role: "student",
    phone: "",
    password: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<UserDetail>(`/api/admin/users/${id}`);
      const u = res.data;
      setUser(u);
      setForm({
        full_name: u.full_name,
        display_name: u.display_name ?? "",
        email: u.email ?? "",
        role: u.role,
        phone: u.phone ?? "",
        password: "",
      });
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load user"
          : "Failed to load user",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        display_name: form.display_name.trim() || null,
        email: form.email.trim(),
        role: form.role,
      };
      if (form.role === "student") {
        body.phone = form.phone.trim() || null;
      }
      if (form.password.trim()) {
        body.password = form.password;
      }
      await adminPatch(`/api/admin/users/${user.id}`, body);
      toast.success("User saved");
      setForm((f) => ({ ...f, password: "" }));
      await load();
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Save failed"
          : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!user) return;
    try {
      await adminPatch(`/api/admin/users/${user.id}`, {
        is_active: !user.is_active,
      });
      toast.success(user.is_active ? "User deactivated" : "User activated");
      await load();
    } catch (err) {
      toast.error("Update failed");
    }
  }

  async function onDeleteConfirm() {
    if (!user) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/users/${user.id}`);
      toast.success("User removed");
      router.replace("/admin/users");
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (loading && !user) {
    return (
      <div>
        <PageHeader title="User" description="Loading…" />
        <Panel>
          <EmptyState message="Loading user…" />
        </Panel>
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="User not found" />
        <Panel>
          <EmptyState message="This user does not exist or was removed." />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.full_name}
        description={user.email ?? "No email on file"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/users"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ArrowLeft className="size-3.5" />
              All users
            </Link>
            {user.role === "student" ? (
              <Link
                href={`/admin/students/${user.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <GraduationCap className="size-3.5" />
                Student profile
              </Link>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void toggleActive()}>
              {user.is_active ? "Deactivate" : "Activate"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Panel className="p-6">
          <form onSubmit={onSave} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  required
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">Display name</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, display_name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
                  value={form.role}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, role: e.target.value }))
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              {form.role === "student" ? (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, phone: e.target.value }))
                    }
                  />
                </div>
              ) : null}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Leave blank to keep current password"
                  value={form.password}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, password: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Min 8 characters. Required when the user signs in with email and
                  password.
                </p>
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </Panel>

        <Panel className="space-y-4 p-5 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <Badge
              variant={user.is_active ? "secondary" : "outline"}
              className="mt-2 capitalize"
            >
              {user.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Enrollments
            </p>
            <p className="mt-1 font-medium">{user.enrollment_count}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Last login
            </p>
            <p className="mt-1 text-muted-foreground">
              {formatDate(user.last_login_at)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Created
            </p>
            <p className="mt-1 text-muted-foreground">
              {formatDate(user.created_at)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Updated
            </p>
            <p className="mt-1 text-muted-foreground">
              {formatDate(user.updated_at)}
            </p>
          </div>
        </Panel>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {user.full_name} will be deactivated and soft-deleted. This cannot be
            undone from the admin UI.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void onDeleteConfirm()}
            >
              {deleting ? "Removing…" : "Remove user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
