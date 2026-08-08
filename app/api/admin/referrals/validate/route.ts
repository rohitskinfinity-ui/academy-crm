import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  inspectReferralCode,
  toAdminReferralValidation,
} from "@/lib/services/referrals";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const code = request.nextUrl.searchParams.get("code") ?? "";
    if (!code.trim()) {
      return apiSuccess(
        {
          valid: true,
          empty: true,
          code: null,
          reason: null,
          message: "No referral code",
          referrer_first_name: null,
          referrer_name: null,
          referrer_email: null,
          friend_discount: null,
          reward_amount: null,
          currency: null,
        },
        "OK",
      );
    }
    const inspected = await inspectReferralCode(code);
    return apiSuccess(toAdminReferralValidation(inspected), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
