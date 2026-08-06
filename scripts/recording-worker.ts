import "dotenv/config";
import { ensureDatabase } from "../lib/db/bootstrap";
import {
  runRecordingWorkerLoop,
  stopRecordingWorkerLoop,
} from "../lib/jobs/recordingWorker";
import { createWorkerId } from "../lib/jobs/recordingQueue";

async function main() {
  if (process.env.RECORDING_SYNC_ENABLED !== "1") {
    console.info(
      "[recording-worker] skipped — recording sync is disabled (set RECORDING_SYNC_ENABLED=1 to enable)",
    );
    process.exit(0);
  }

  await ensureDatabase();

  const workerId = createWorkerId("cli");
  const shutdown = () => {
    console.info("[recording-worker] shutdown signal — finishing current job…");
    stopRecordingWorkerLoop();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runRecordingWorkerLoop({ workerId });
  process.exit(0);
}

main().catch((err) => {
  console.error("[recording-worker] fatal", err);
  process.exit(1);
});
