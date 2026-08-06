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

  // Zoom→GCP recording worker — disabled for now (re-enable later with
  // RECORDING_WORKER_EMBEDDED=1 or `npm run worker:recordings`).
  if (process.env.RECORDING_WORKER_EMBEDDED === "1") {
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
