import { hashPassword } from "@/lib/auth/password";
import { db } from "./index";
import { USERS_TABLE } from "./schema";

export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME?.trim() || "Admin";

  if (!email || !password) {
    console.info(
      "[db] Skipping admin seed: ADMIN_EMAIL / ADMIN_PASSWORD not set",
    );
    return;
  }

  const [existing] = await db.query<{ id: string }>(
    `SELECT id FROM ${USERS_TABLE}
     WHERE role IN ('admin', 'staff') AND deleted_at IS NULL
     LIMIT 1`,
  );

  if (Array.isArray(existing) && existing.length > 0) {
    console.info("[db] Admin user already exists, skip seed");
    return;
  }

  const passwordHash = await hashPassword(password);

  await db.query(
    `INSERT INTO ${USERS_TABLE} (email, password_hash, full_name, role, is_active)
     VALUES ($1, $2, $3, 'admin', true)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = 'admin',
       is_active = true,
       deleted_at = NULL,
       updated_at = now()`,
    [email, passwordHash, fullName],
  );

  console.info(`[db] Seeded admin user: ${email}`);
}
