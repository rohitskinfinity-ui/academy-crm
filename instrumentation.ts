export async function register() {
  // Only run DB bootstrap in the Node.js runtime (not Edge).
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Skip during `next build` when DATABASE_URL may be absent.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL not set; skipping DB bootstrap");
    return;
  }

  try {
    const { ensureDatabase } = await import("@/lib/db/bootstrap");
    await ensureDatabase();
  } catch (err) {
    // Do not crash the Next.js process if DB is unreachable / misconfigured.
    console.error(
      "[instrumentation] DB bootstrap failed — fix DATABASE_URL and restart (or run npm run db:migrate)",
      err,
    );
  }

  // Durable Zoom→GCP recording worker (Postgres queue).
  // Dev: on by default. Prod: set RECORDING_WORKER_EMBEDDED=1, or run
  // `npm run worker:recordings` as a separate process (recommended).
  const embedWorker =
    process.env.RECORDING_WORKER_EMBEDDED === "1" ||
    (process.env.RECORDING_WORKER_EMBEDDED !== "0" &&
      process.env.NODE_ENV === "development");

  if (embedWorker) {
    try {
      const { isRecordingWorkerLoopRunning, runRecordingWorkerLoop } =
        await import("@/lib/jobs/recordingWorker");
      if (!isRecordingWorkerLoopRunning()) {
        void runRecordingWorkerLoop().catch((err) => {
          console.error("[instrumentation] recording worker failed", err);
        });
      }
    } catch (err) {
      console.error("[instrumentation] failed to start recording worker", err);
    }
  }
}
