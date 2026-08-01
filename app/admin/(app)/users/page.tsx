"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import axios from "axios";
import { toast } from "sonner";
import { Eye, Plus, Search, Trash2 } from "lucide-react";
import { AdminTableSkeleton } from "@/components/admin/table-skeleton";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminDelete, adminGet, adminPatch, adminPost } from "@/lib/api/admin-client";
import { useAdminAuth } from "@/store/admin-auth";
import { cn } from "@/lib/utils";

type User = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type Paginated = {
  items: User[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

const ROLES = ["student", "instructor", "staff", "admin"] as const;

export default function AdminUsersPage() {
  const admin = useAdminAuth((s) => s.admin);
  const isSuperAdmin = admin?.role === "admin";

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    display_name: "",
    role: "student",
    password: "",
    phone: "",
  });

  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGet<Paginated>("/api/admin/users", {
        search: search || undefined,
        role: role || undefined,
        is_active: activeFilter || undefined,
        page,
        limit: 20,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Failed to load users"
          : "Failed to load users",
      );
    } finally {
      setLoading(false);
    }
  }, [search, role, activeFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setUserActive(user: User, is_active: boolean) {
    setTogglingId(user.id);
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((u) =>
              u.id === user.id ? { ...u, is_active } : u,
            ),
          }
        : prev,
    );
    try {
      await adminPatch(`/api/admin/users/${user.id}`, { is_active });
      toast.success(is_active ? "User activated" : "User deactivated");
    } catch (err) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((u) =>
                u.id === user.id ? { ...u, is_active: user.is_active } : u,
              ),
            }
          : prev,
      );
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Update failed"
          : "Update failed",
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await adminPost<User>("/api/admin/users", {
        full_name: createForm.full_name.trim(),
        email: createForm.email.trim(),
        display_name: createForm.display_name.trim() || null,
        role: createForm.role,
        password: createForm.password.trim() || undefined,
        phone: createForm.phone.trim() || null,
      });
      toast.success("User created");
      setCreateOpen(false);
      setCreateForm({
        full_name: "",
        email: "",
        display_name: "",
        role: "student",
        password: "",
        phone: "",
      });
      if (res.data?.id) {
        window.location.href = `/admin/users/${res.data.id}`;
      } else {
        await load();
      }
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Create failed"
          : "Create failed",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminDelete(`/api/admin/users/${deleteTarget.id}`);
      toast.success("User removed");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const needsPassword =
    createForm.role === "admin" ||
    createForm.role === "staff" ||
    createForm.role === "instructor";

  return (
    <div>
      <PageHeader
        title="User management"
        description="Create accounts, assign roles, and control access for students, instructors, staff, and admins."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            Create user
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 pl-9"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
          />
        </div>
        <select
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm capitalize"
          value={role}
          onChange={(e) => {
            setPage(1);
            setRole(e.target.value);
          }}
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm"
          value={activeFilter}
          onChange={(e) => {
            setPage(1);
            setActiveFilter(e.target.value as "" | "true" | "false");
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {loading && !data ? (
        <AdminTableSkeleton
          headers={[
            "Name",
            "Email",
            "Role",
            "Status",
            "Last login",
            "Actions",
          ]}
          reservedOffset={320}
        />
      ) : (
        <Panel>
          {!data?.items.length ? (
            <EmptyState message="No users found." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {user.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.email ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Switch
                            checked={user.is_active}
                            disabled={togglingId === user.id}
                            aria-label={`${user.full_name} ${user.is_active ? "active" : "inactive"}`}
                            onCheckedChange={(checked) =>
                              void setUserActive(user, checked)
                            }
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              user.is_active
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(user.last_login_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className={cn(
                              buttonVariants({ size: "icon-sm", variant: "ghost" }),
                            )}
                            title="View / edit"
                          >
                            <Eye className="size-3.5" />
                          </Link>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
                <span className="text-muted-foreground">
                  {data.pagination.total} total
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= data.pagination.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Panel>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create_full_name">Full name</Label>
              <Input
                id="create_full_name"
                required
                value={createForm.full_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_email">Email</Label>
              <Input
                id="create_email"
                type="email"
                required
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_display_name">Display name (optional)</Label>
              <Input
                id="create_display_name"
                value={createForm.display_name}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, display_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create_role">Role</Label>
              <select
                id="create_role"
                className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm capitalize"
                value={createForm.role}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, role: e.target.value }))
                }
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                {isSuperAdmin ? (
                  <>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </>
                ) : null}
              </select>
            </div>
            {createForm.role === "student" ? (
              <div className="space-y-2">
                <Label htmlFor="create_phone">Phone (optional)</Label>
                <Input
                  id="create_phone"
                  value={createForm.phone}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="create_password">
                Password{needsPassword ? " *" : " (optional)"}
              </Label>
              <Input
                id="create_password"
                type="password"
                required={needsPassword}
                minLength={needsPassword ? 8 : undefined}
                placeholder={
                  needsPassword
                    ? "Min 8 characters"
                    : "Auto-generated if empty"
                }
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget?.full_name} will be soft-deleted and deactivated.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void onDeleteConfirm()}
            >
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
