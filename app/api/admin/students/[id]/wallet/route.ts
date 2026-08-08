import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { getReferralWallet } from "@/lib/services/referrals";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    if (!id) return apiError("Student id is required", 400);
    const wallet = await getReferralWallet(id);
    return apiSuccess(wallet, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
