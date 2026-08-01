import { db } from "@/lib/db";
import {
  ENROLLMENTS_TABLE,
  INSTRUCTOR_PROFILES_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import crypto from "crypto";

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

export type UserDetail = AdminUserRow & {
  phone: string | null;
  enrollment_count: number;
};

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  const user = await getUserById(id);
  if (!user) return null;

  let phone: string | null = null;
  if (user.role === "student") {
    const [profileRows] = await db.query<{ phone: string | null }>(
      `SELECT phone FROM ${STUDENT_PROFILES_TABLE} WHERE user_id = $1 LIMIT 1`,
      [id],
    );
    phone = Array.isArray(profileRows) ? profileRows[0]?.phone ?? null : null;
  }

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${ENROLLMENTS_TABLE} WHERE user_id = $1`,
    [id],
  );
  const enrollment_count = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  return { ...user, phone, enrollment_count };
}

export async function createUser(input: {
  email: string;
  full_name: string;
  display_name?: string | null;
  role: "student" | "instructor" | "admin" | "staff";
  password?: string;
  phone?: string | null;
}) {
  let passwordHash: string | null = null;
  if (input.password) {
    passwordHash = await hashPassword(input.password);
  } else if (input.role === "student") {
    passwordHash = await hashPassword(`SA-${crypto.randomUUID()}`);
  }

  if (
    (input.role === "admin" ||
      input.role === "staff" ||
      input.role === "instructor") &&
    !passwordHash
  ) {
    throw Object.assign(new Error("Password is required"), { status: 400 });
  }

  try {
    const [rows] = await db.query<AdminUserRow>(
      `INSERT INTO ${USERS_TABLE}
         (email, password_hash, full_name, display_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, display_name, avatar_url, role, is_active,
                 last_login_at::text, created_at::text, updated_at::text`,
      [
        input.email,
        passwordHash,
        input.full_name,
        input.display_name ?? null,
        input.role,
      ],
    );
    const user = Array.isArray(rows) ? rows[0] : null;
    if (!user) {
      throw Object.assign(new Error("Failed to create user"), { status: 500 });
    }

    if (input.role === "student") {
      await db.query(
        `INSERT INTO ${STUDENT_PROFILES_TABLE} (user_id, phone)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now()`,
        [user.id, input.phone ?? null],
      );
    }

    if (input.role === "instructor") {
      await db.query(
        `INSERT INTO ${INSTRUCTOR_PROFILES_TABLE} (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id],
      );
    }

    return user;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      throw Object.assign(new Error("Email already in use"), { status: 409 });
    }
    throw err;
  }
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
    password?: string;
    phone?: string | null;
  },
) {
  const { password, phone, ...userPatch } = patch;
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const [key, value] of Object.entries(userPatch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }

  if (password !== undefined) {
    const passwordHash = await hashPassword(password);
    fields.push(`password_hash = $${i++}`);
    params.push(passwordHash);
  }

  if (fields.length === 0 && phone === undefined) {
    return getUserById(id);
  }

  let updated: AdminUserRow | null = null;

  if (fields.length > 0) {
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
      updated = Array.isArray(rows) ? rows[0] ?? null : null;
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        throw Object.assign(new Error("Email already in use"), { status: 409 });
      }
      throw err;
    }
  } else {
    updated = await getUserById(id);
  }

  if (updated && phone !== undefined && updated.role === "student") {
    await db.query(
      `INSERT INTO ${STUDENT_PROFILES_TABLE} (user_id, phone)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET phone = EXCLUDED.phone, updated_at = now()`,
      [id, phone],
    );
  }

  return updated;
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
