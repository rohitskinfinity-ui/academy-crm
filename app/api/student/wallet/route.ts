import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getReferralWallet } from "@/lib/services/referrals";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const wallet = await getReferralWallet(user.id);
    return apiSuccess(wallet, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
