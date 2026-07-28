import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { USERS_TABLE } from "@/lib/db/schema";
import { verifyAdminToken, type AdminJwtPayload } from "./jwt";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "staff";
  is_active: boolean;
};

function extractToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  const xAccess = request.headers.get("x-access-token");
  return xAccess?.trim() || null;
}

export async function requireAdmin(
  request: NextRequest,
): Promise<{ user: AdminUser; token: AdminJwtPayload }> {
  const token = extractToken(request);
  if (!token) {
    throw new AuthError("No token provided", 401);
  }

  let payload: AdminJwtPayload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    throw new AuthError("Failed to authenticate token", 403);
  }

  const [rows] = await db.query<AdminUser>(
    `SELECT id, email, full_name, display_name, avatar_url, role, is_active
     FROM ${USERS_TABLE}
     WHERE id = $1
       AND role IN ('admin', 'staff')
       AND deleted_at IS NULL
     LIMIT 1`,
    [payload.userId],
  );

  const user = Array.isArray(rows) ? rows[0] : undefined;
  if (!user) {
    throw new AuthError("Admin not found", 403);
  }
  if (!user.is_active) {
    throw new AuthError("Admin account is inactive", 403);
  }

  return { user, token: payload };
}
