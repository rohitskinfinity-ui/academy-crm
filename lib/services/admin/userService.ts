import { db } from "@/lib/db";
import { USERS_TABLE } from "@/lib/db/schema";

export type AdminUserRow = {
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
};

export async function listUsers(opts: {
  role?: string;
  search?: string;
  page: number;
  limit: number;
  is_active?: boolean;
}) {
  const where: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.role) {
    where.push(`role = $${i++}`);
    params.push(opts.role);
  }
  if (opts.is_active !== undefined) {
    where.push(`is_active = $${i++}`);
    params.push(opts.is_active);
  }
  if (opts.search?.trim()) {
    where.push(
      `(full_name ILIKE $${i} OR email ILIKE $${i} OR display_name ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${USERS_TABLE} ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query<AdminUserRow>(
    `SELECT id, email, full_name, display_name, avatar_url, role, is_active,
            last_login_at::text, created_at::text, updated_at::text
     FROM ${USERS_TABLE}
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  return {
    items: Array.isArray(rows) ? rows : [],
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}

export async function getUserById(id: string) {
  const [rows] = await db.query<AdminUserRow>(
    `SELECT id, email, full_name, display_name, avatar_url, role, is_active,
            last_login_at::text, created_at::text, updated_at::text
     FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function patchUser(
  id: string,
  patch: {
    full_name?: string;
    display_name?: string | null;
    avatar_url?: string | null;
    role?: string;
    is_active?: boolean;
    email?: string;
  },
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }

  if (fields.length === 0) {
    return getUserById(id);
  }

  fields.push("updated_at = now()");
  params.push(id);

  try {
    const [rows] = await db.query<AdminUserRow>(
      `UPDATE ${USERS_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING id, email, full_name, display_name, avatar_url, role, is_active,
                 last_login_at::text, created_at::text, updated_at::text`,
      params,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      throw Object.assign(new Error("Email already in use"), { status: 409 });
    }
    throw err;
  }
}

export async function softDeleteUser(id: string) {
  const [rows] = await db.query<{ id: string }>(
    `UPDATE ${USERS_TABLE}
     SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
