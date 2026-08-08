import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { validatePublicReferralCode } from "@/lib/services/referrals";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    const code = request.nextUrl.searchParams.get("code") ?? "";
    if (!code.trim()) {
      return apiError("Referral code is required", 400);
    }
    const email = request.nextUrl.searchParams.get("email") ?? "";
    const data = await validatePublicReferralCode(code, {
      inviteeEmail: email || null,
    });
    return apiSuccess(data, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
