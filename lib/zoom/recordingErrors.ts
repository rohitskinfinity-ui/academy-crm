import axios from "axios";

export type ZoomRecordingErrorKind =
  | "not_found"
  | "permanent"
  | "transient";

export class ZoomRecordingError extends Error {
  readonly kind: ZoomRecordingErrorKind;
  readonly userMessage: string;
  readonly httpStatus?: number;

  constructor(
    kind: ZoomRecordingErrorKind,
    message: string,
    opts?: { userMessage?: string; httpStatus?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "ZoomRecordingError";
    this.kind = kind;
    this.userMessage = opts?.userMessage || message;
    this.httpStatus = opts?.httpStatus;
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

const NOT_FOUND_PATTERNS = [
  /recording does not exist/i,
  /no recording/i,
  /recording.*(not found|unavailable)/i,
  /meeting recording.*not found/i,
];

const PERMANENT_PATTERNS = [
  /does not contain scopes/i,
  /invalid access token/i,
  /missing.*scope/i,
  /not authorized/i,
  /permission denied/i,
  /cloud recording.*(disabled|not enabled)/i,
  /upgrade.*pro/i,
];

/** Soft retries for “not ready yet” — Zoom may still be processing. */
export const RECORDING_NOT_FOUND_MAX_ATTEMPTS = Number(
  process.env.RECORDING_NOT_FOUND_MAX_ATTEMPTS || 3,
);

export function classifyZoomRecordingMessage(
  message: string,
  httpStatus?: number,
): ZoomRecordingErrorKind {
  const text = message || "";

  if (NOT_FOUND_PATTERNS.some((re) => re.test(text))) return "not_found";
  if (httpStatus === 404) return "not_found";

  if (PERMANENT_PATTERNS.some((re) => re.test(text))) return "permanent";
  if (httpStatus === 401 || httpStatus === 403) return "permanent";

  // 429 / 5xx → transient
  if (httpStatus === 429 || (httpStatus != null && httpStatus >= 500)) {
    return "transient";
  }

  return "transient";
}

export function userMessageForZoomRecordingError(
  kind: ZoomRecordingErrorKind,
  rawMessage: string,
): string {
  switch (kind) {
    case "not_found":
      return (
        "No Zoom cloud recording yet. Finish the meeting, wait until it " +
        "appears under Zoom → Cloud recordings, then Retry sync."
      );
    case "permanent":
      if (/scope/i.test(rawMessage)) {
        return (
          "Zoom app is missing recording scopes " +
          "(cloud_recording:read:list_recording_files). Update Marketplace scopes and retry."
        );
      }
      return rawMessage || "Zoom rejected this recording request.";
    default:
      return rawMessage || "Temporary Zoom/network error — will retry.";
  }
}

export function zoomRecordingErrorFromAxios(err: unknown): ZoomRecordingError {
  if (err instanceof ZoomRecordingError) return err;

  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as
      | { message?: string; error?: string; code?: number }
      | undefined;
    const raw =
      data?.message || data?.error || err.message || "Zoom API error";
    const kind = classifyZoomRecordingMessage(raw, status);
    return new ZoomRecordingError(kind, raw, {
      userMessage: userMessageForZoomRecordingError(kind, raw),
      httpStatus: status,
      cause: err,
    });
  }

  const raw = err instanceof Error ? err.message : String(err);
  const kind = classifyZoomRecordingMessage(raw);
  return new ZoomRecordingError(kind, raw, {
    userMessage: userMessageForZoomRecordingError(kind, raw),
    cause: err,
  });
}

export function toZoomRecordingError(err: unknown): ZoomRecordingError {
  if (err instanceof ZoomRecordingError) return err;
  return zoomRecordingErrorFromAxios(err);
}
