import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    // Stateless JWT — client discards token. Denylist can be added later.
    return apiSuccess(null, "Logged out");
  } catch (err) {
    return handleApiError(err);
  }
}
