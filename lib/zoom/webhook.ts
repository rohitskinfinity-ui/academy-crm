import crypto from "crypto";

const ZOOM_SECRET_TOKEN =
  process.env.ZOOM_SECRET_TOKEN || process.env.ZOOM_WEBHOOK_SECRET_TOKEN || "";

export function getZoomWebhookSecret(): string {
  return ZOOM_SECRET_TOKEN;
}

export function verifyZoomWebhookSignature(opts: {
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
}): boolean {
  const secret = getZoomWebhookSecret();
  if (!secret || !opts.signature || !opts.timestamp) return false;

  // Reject stale requests (> 5 minutes)
  const ts = Number(opts.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
    return false;
  }

  const message = `v0:${opts.timestamp}:${opts.rawBody}`;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = `v0=${hash}`;

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(opts.signature);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function zoomUrlValidationResponse(plainToken: string): {
  plainToken: string;
  encryptedToken: string;
} {
  const secret = getZoomWebhookSecret();
  const encryptedToken = crypto
    .createHmac("sha256", secret)
    .update(plainToken)
    .digest("hex");
  return { plainToken, encryptedToken };
}

export type ZoomWebhookBody = {
  event: string;
  payload?: {
    plainToken?: string;
    object?: {
      id?: string | number;
      uuid?: string;
      topic?: string;
      start_time?: string;
      download_access_token?: string;
      participant?: {
        user_id?: string;
        user_name?: string;
        email?: string;
        join_time?: string;
        id?: string;
      };
      recording_files?: Array<{
        id?: string;
        file_type?: string;
        file_extension?: string;
        file_size?: number;
        download_url?: string;
        play_url?: string;
        recording_type?: string;
        recording_start?: string;
        recording_end?: string;
      }>;
    };
  };
};

/** @deprecated use ZoomWebhookBody */
export type ZoomParticipantJoinedPayload = ZoomWebhookBody;
