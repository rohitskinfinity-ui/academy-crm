import { comparePassword, hashPassword } from "@/lib/auth/password";
import { signAdminToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import { USERS_TABLE } from "@/lib/db/schema";

export type PublicAdmin = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "staff";
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

type AdminRow = PublicAdmin & { password_hash: string | null };

function toPublic(row: AdminRow | PublicAdmin): PublicAdmin {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    display_name: row.display_name,
    avatar_url: row.avatar_url,
    role: row.role,
    is_active: row.is_active,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
  };
}

export async function adminLogin(email: string, password: string) {
  const [rows] = await db.query<AdminRow>(
    `SELECT id, email, password_hash, full_name, display_name, avatar_url,
            role, is_active, last_login_at::text, created_at::text
     FROM ${USERS_TABLE}
     WHERE email = $1
       AND role IN ('admin', 'staff')
       AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );

  const user = Array.isArray(rows) ? rows[0] : undefined;
  if (!user || !user.password_hash) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }
  if (!user.is_active) {
    throw Object.assign(new Error("Account is inactive"), { status: 403 });
  }

  const ok = await comparePassword(password, user.password_hash);
  if (!ok) {
    throw Object.assign(new Error("Invalid email or password"), { status: 401 });
  }

  await db.query(
    `UPDATE ${USERS_TABLE} SET last_login_at = now(), updated_at = now() WHERE id = $1`,
    [user.id],
  );

  const token = signAdminToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return { token, admin: toPublic(user) };
}

export async function listAdmins() {
  const [rows] = await db.query<PublicAdmin>(
    `SELECT id, email, full_name, display_name, avatar_url,
            role, is_active, last_login_at::text, created_at::text
     FROM ${USERS_TABLE}
     WHERE role IN ('admin', 'staff')
       AND deleted_at IS NULL
     ORDER BY created_at ASC`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createAdmin(input: {
  email: string;
  password: string;
  full_name: string;
  display_name?: string | null;
  role: "admin" | "staff";
}) {
  const passwordHash = await hashPassword(input.password);

  try {
    const [rows] = await db.query<PublicAdmin>(
      `INSERT INTO ${USERS_TABLE}
         (email, password_hash, full_name, display_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, email, full_name, display_name, avatar_url,
                 role, is_active, last_login_at::text, created_at::text`,
      [
        input.email,
        passwordHash,
        input.full_name,
        input.display_name ?? null,
        input.role,
      ],
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      throw Object.assign(new Error("Email already in use"), { status: 409 });
    }
    throw err;
  }
}

export async function getAdminById(id: string) {
  const [rows] = await db.query<PublicAdmin>(
    `SELECT id, email, full_name, display_name, avatar_url,
            role, is_active, last_login_at::text, created_at::text
     FROM ${USERS_TABLE}
     WHERE id = $1
       AND role IN ('admin', 'staff')
       AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
