import "dotenv/config";
import { ensureDatabase } from "../lib/db/bootstrap";
import {
  runRecordingWorkerLoop,
  stopRecordingWorkerLoop,
} from "../lib/jobs/recordingWorker";
import { createWorkerId } from "../lib/jobs/recordingQueue";

async function main() {
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
