import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { LIVE_CLASS_RECORDINGS_TABLE } from "@/lib/db/schema";
import type { LiveClassRecordingRow } from "@/lib/services/admin/liveClassRecordingService";

/** Stale processing jobs (no heartbeat) are returned to the queue. */
export const RECORDING_STALE_LOCK_MS = Number(
  process.env.RECORDING_STALE_LOCK_MS || 45 * 60 * 1000,
);

/** Max concurrent Zoom→GCP streams per worker process. */
export const RECORDING_WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.RECORDING_WORKER_CONCURRENCY || 1),
);

const BACKOFF_SECONDS = [60, 300, 900, 1800, 3600];
/** Softer backoff while Zoom is still processing the cloud recording. */
const NOT_FOUND_BACKOFF_SECONDS = [120, 600, 1800];

export type QueuedRecordingRow = LiveClassRecordingRow & {
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  locked_at: string | null;
  locked_by: string | null;
};

export function createWorkerId(prefix = "worker"): string {
  return `${prefix}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function backoffSeconds(attemptCount: number): number {
  const idx = Math.min(
    Math.max(attemptCount - 1, 0),
    BACKOFF_SECONDS.length - 1,
  );
  return BACKOFF_SECONDS[idx]!;
}

/** Re-queue jobs whose lock heartbeat went stale (crashed worker / killed process). */
export async function recoverStaleRecordingLocks(): Promise<number> {
  const staleSeconds = Math.max(60, Math.floor(RECORDING_STALE_LOCK_MS / 1000));
  const [rows] = await db.query<{ id: string }>(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET status = 'pending',
         locked_at = NULL,
         locked_by = NULL,
         next_attempt_at = now(),
         error_message = COALESCE(error_message, 'Stale lock recovered — will retry'),
         updated_at = now()
     WHERE status = 'processing'
       AND (
         (locked_at IS NOT NULL AND locked_at < now() - ($1::text || ' seconds')::interval)
         OR (locked_at IS NULL AND updated_at < now() - ($1::text || ' seconds')::interval)
       )
     RETURNING id`,
    [String(staleSeconds)],
  );
  return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Claim the next due pending job (SKIP LOCKED — safe with multiple workers).
 */
export async function claimNextRecordingJob(
  workerId: string,
): Promise<QueuedRecordingRow | null> {
  const [rows] = await db.query<QueuedRecordingRow>(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET status = 'processing',
         locked_at = now(),
         locked_by = $1,
         attempt_count = attempt_count + 1,
         error_message = NULL,
         updated_at = now()
     WHERE id = (
       SELECT id
       FROM ${LIVE_CLASS_RECORDINGS_TABLE}
       WHERE status = 'pending'
         AND next_attempt_at <= now()
       ORDER BY next_attempt_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING *`,
    [workerId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

export async function touchRecordingLock(
  recordingId: string,
  workerId: string,
): Promise<void> {
  await db.query(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET locked_at = now(), updated_at = now()
     WHERE id = $1 AND locked_by = $2 AND status = 'processing'`,
    [recordingId, workerId],
  );
}

export type RecordingFailKind = "not_found" | "permanent" | "transient";

async function markFailed(
  recordingId: string,
  errorMessage: string,
): Promise<"failed"> {
  await db.query(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET status = 'failed',
         locked_at = NULL,
         locked_by = NULL,
         error_message = $2,
         updated_at = now()
     WHERE id = $1`,
    [recordingId, errorMessage],
  );
  return "failed";
}

export async function markRecordingJobRetryOrFail(
  recordingId: string,
  errorMessage: string,
  opts?: {
    kind?: RecordingFailKind;
    /** Cap soft retries for "recording does not exist". */
    notFoundMaxAttempts?: number;
  },
): Promise<"retry" | "failed"> {
  const kind = opts?.kind ?? "transient";
  const [rows] = await db.query<QueuedRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE} WHERE id = $1`,
    [recordingId],
  );
  const job = Array.isArray(rows) ? rows[0] : null;
  if (!job) return "failed";

  // Config / auth errors — fail immediately, no more auto retries
  if (kind === "permanent") {
    return markFailed(recordingId, errorMessage);
  }

  const notFoundCap = Math.max(
    1,
    opts?.notFoundMaxAttempts ??
      Number(process.env.RECORDING_NOT_FOUND_MAX_ATTEMPTS || 3),
  );
  const maxAttempts =
    kind === "not_found"
      ? Math.min(job.max_attempts, notFoundCap)
      : job.max_attempts;

  if (job.attempt_count >= maxAttempts) {
    return markFailed(recordingId, errorMessage);
  }

  const delay =
    kind === "not_found"
      ? NOT_FOUND_BACKOFF_SECONDS[
          Math.min(
            Math.max(job.attempt_count - 1, 0),
            NOT_FOUND_BACKOFF_SECONDS.length - 1,
          )
        ]!
      : backoffSeconds(job.attempt_count);

  await db.query(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET status = 'pending',
         locked_at = NULL,
         locked_by = NULL,
         next_attempt_at = now() + ($2::text || ' seconds')::interval,
         error_message = $3,
         updated_at = now()
     WHERE id = $1`,
    [recordingId, String(delay), errorMessage],
  );
  return "retry";
}

export async function clearRecordingLock(recordingId: string): Promise<void> {
  await db.query(
    `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
     SET locked_at = NULL, locked_by = NULL, updated_at = now()
     WHERE id = $1`,
    [recordingId],
  );
}
