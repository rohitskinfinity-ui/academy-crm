import crypto from "crypto";
import jwt from "jsonwebtoken";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export type GoogleProfile = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type OAuthStatePayload = {
  nonce: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return secret;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    "http://localhost:3000/api/public/auth/google/callback";

  if (!clientId || !clientSecret) {
    throw Object.assign(
      new Error("Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)"),
      { status: 500 },
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function getStudentWebUrl(): string {
  return (
    process.env.STUDENT_WEB_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3001"
  );
}

/** Short-lived signed state to prevent CSRF on OAuth callback. */
export function createGoogleOAuthState(): string {
  const payload: OAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString("hex"),
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "10m" });
}

export function verifyGoogleOAuthState(state: string): boolean {
  try {
    const decoded = jwt.verify(state, getJwtSecret()) as OAuthStatePayload;
    return Boolean(decoded?.nonce);
  } catch {
    return false;
  }
}

export function buildGoogleAuthUrl(state: string): string {
  const { clientId, redirectUri } = getGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    prompt: "select_account",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
}> {
  const { clientId, clientSecret, redirectUri } = getGoogleConfig();

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof data.access_token !== "string") {
    throw Object.assign(
      new Error(
        typeof data.error_description === "string"
          ? data.error_description
          : "Failed to exchange Google authorization code",
      ),
      { status: 400 },
    );
  }

  return {
    access_token: data.access_token,
    expires_in:
      typeof data.expires_in === "number" ? data.expires_in : undefined,
    refresh_token:
      typeof data.refresh_token === "string" ? data.refresh_token : undefined,
    id_token: typeof data.id_token === "string" ? data.id_token : undefined,
  };
}

export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<GoogleProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || typeof data.sub !== "string" || typeof data.email !== "string") {
    throw Object.assign(new Error("Failed to fetch Google user profile"), {
      status: 400,
    });
  }

  return {
    sub: data.sub,
    email: data.email,
    email_verified:
      typeof data.email_verified === "boolean"
        ? data.email_verified
        : undefined,
    name: typeof data.name === "string" ? data.name : undefined,
    picture: typeof data.picture === "string" ? data.picture : undefined,
  };
}
