import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { USERS_TABLE } from "@/lib/db/schema";
import { AuthError } from "./admin";
import { verifyStudentToken, type StudentJwtPayload } from "./jwt";

export type StudentUser = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "student";
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

export async function requireStudent(
  request: NextRequest,
): Promise<{ user: StudentUser; token: StudentJwtPayload }> {
  const token = extractToken(request);
  if (!token) {
    throw new AuthError("No token provided", 401);
  }

  let payload: StudentJwtPayload;
  try {
    payload = verifyStudentToken(token);
  } catch {
    throw new AuthError("Failed to authenticate token", 403);
  }

  const [rows] = await db.query<StudentUser>(
    `SELECT id, email, full_name, display_name, avatar_url, role, is_active
     FROM ${USERS_TABLE}
     WHERE id = $1
       AND role = 'student'
       AND deleted_at IS NULL
     LIMIT 1`,
    [payload.userId],
  );

  const user = Array.isArray(rows) ? rows[0] : undefined;
  if (!user) {
    throw new AuthError("Student not found", 403);
  }
  if (!user.is_active) {
    throw new AuthError("Student account is inactive", 403);
  }

  return { user, token: payload };
}
