import {
  claimNextRecordingJob,
  createWorkerId,
  recoverStaleRecordingLocks,
  RECORDING_WORKER_CONCURRENCY,
  touchRecordingLock,
} from "@/lib/jobs/recordingQueue";
import { processRecordingJob } from "@/lib/services/admin/liveClassRecordingService";

const HEARTBEAT_MS = 30_000;
const IDLE_POLL_MS = Number(process.env.RECORDING_WORKER_POLL_MS || 3000);

let loopRunning = false;
let stopRequested = false;

/**
 * Claim and process up to `limit` queued recording jobs.
 * Safe to call from Next.js `after()` or a dedicated worker process.
 */
export async function processAvailableRecordingJobs(
  limit = RECORDING_WORKER_CONCURRENCY,
  workerId = createWorkerId("kick"),
): Promise<number> {
  const recovered = await recoverStaleRecordingLocks();
  if (recovered > 0) {
    console.info(`[recording-worker] recovered ${recovered} stale lock(s)`);
  }

  let processed = 0;
  const max = Math.max(1, limit);

  for (let i = 0; i < max; i++) {
    const job = await claimNextRecordingJob(workerId);
    if (!job) break;

    const heartbeat = setInterval(() => {
      void touchRecordingLock(job.id, workerId).catch((err) => {
        console.warn(`[recording-worker] heartbeat failed job=${job.id}`, err);
      });
    }, HEARTBEAT_MS);

    try {
      console.info(
        `[recording-worker] start job=${job.id} attempt=${job.attempt_count}/${job.max_attempts}`,
      );
      await processRecordingJob(job.id, { workerId });
      processed += 1;
    } catch (err) {
      console.error(`[recording-worker] job=${job.id} error`, err);
    } finally {
      clearInterval(heartbeat);
    }
  }

  return processed;
}

/** Long-running poll loop (standalone script or embedded in Next.js). */
export async function runRecordingWorkerLoop(opts?: {
  workerId?: string;
  concurrency?: number;
}): Promise<void> {
  if (loopRunning) {
    console.warn("[recording-worker] loop already running — skip");
    return;
  }
  loopRunning = true;
  stopRequested = false;
  const workerId = opts?.workerId || createWorkerId("loop");
  const concurrency = opts?.concurrency ?? RECORDING_WORKER_CONCURRENCY;

  console.info(
    `[recording-worker] started id=${workerId} concurrency=${concurrency}`,
  );

  while (!stopRequested) {
    try {
      const n = await processAvailableRecordingJobs(concurrency, workerId);
      if (n === 0) {
        await sleep(IDLE_POLL_MS);
      }
    } catch (err) {
      console.error("[recording-worker] loop error", err);
      await sleep(IDLE_POLL_MS);
    }
  }

  loopRunning = false;
  console.info("[recording-worker] stopped");
}

export function stopRecordingWorkerLoop(): void {
  stopRequested = true;
}

export function isRecordingWorkerLoopRunning(): boolean {
  return loopRunning;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
