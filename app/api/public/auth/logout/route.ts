import { NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    // Token is client-managed; validate when present for symmetry.
    try {
      await requireStudent(request);
    } catch {
      // Already logged out / invalid token — still OK
    }
    return apiSuccess({ ok: true }, "Logged out");
  } catch (err) {
    return handleApiError(err);
  }
}
