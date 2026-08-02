import { NextRequest, NextResponse } from "next/server";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  getStudentWebUrl,
  verifyGoogleOAuthState,
} from "@/lib/auth/google";
import { completeGoogleStudentLogin } from "@/lib/services/public/studentAuthService";

function redirectToWeb(path: string) {
  const base = getStudentWebUrl();
  return NextResponse.redirect(`${base}${path.startsWith("/") ? path : `/${path}`}`);
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const oauthError = request.nextUrl.searchParams.get("error");

    if (oauthError) {
      return redirectToWeb(`/login?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state || !verifyGoogleOAuthState(state)) {
      return redirectToWeb("/login?error=invalid_state");
    }

    const tokens = await exchangeGoogleCode(code);
    const profile = await fetchGoogleUserInfo(tokens.access_token);
    const result = await completeGoogleStudentLogin({
      profile,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
    });

    if ("error" in result) {
      return redirectToWeb(`/login?error=${encodeURIComponent(result.error)}`);
    }

    return redirectToWeb(
      `/auth/callback?token=${encodeURIComponent(result.token)}`,
    );
  } catch (err) {
    console.error("[google/callback]", err);
    return redirectToWeb("/login?error=oauth_failed");
  }
}
