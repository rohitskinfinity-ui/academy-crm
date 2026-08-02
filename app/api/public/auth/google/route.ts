import { NextResponse } from "next/server";
import {
  buildGoogleAuthUrl,
  createGoogleOAuthState,
} from "@/lib/auth/google";
import { handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const state = createGoogleOAuthState();
    const url = buildGoogleAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (err) {
    return handleApiError(err);
  }
}
