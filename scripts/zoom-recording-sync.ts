import "dotenv/config";
import { ensureDatabase } from "../lib/db/bootstrap";
import { runZoomRecordingSync } from "../lib/services/admin/zoomRecordingSyncService";

/**
 * One-shot Zoom cloud recording sync.
 * Schedule via OS cron at midnight Asia/Kolkata, e.g.:
 *   0 0 * * * cd /path/to/academy-crm && npm run sync:zoom-recordings
 */
async function main() {
  await ensureDatabase();

  const dryRun = process.argv.includes("--dry-run");
  const started = Date.now();
  console.info(
    `[zoom-sync] start dryRun=${dryRun} at ${new Date().toISOString()}`,
  );

  const summary = await runZoomRecordingSync({ dryRun });
  const ms = Date.now() - started;

  console.info(
    `[zoom-sync] done in ${ms}ms`,
    JSON.stringify({
      from: summary.from,
      to: summary.to,
      timezone: summary.timezone,
      listed: summary.listed,
      matched: summary.matched,
      enqueued: summary.enqueued,
      already_ready: summary.already_ready,
      processed: summary.processed,
      skipped_orphan: summary.skipped_orphan,
      skipped_no_mp4: summary.skipped_no_mp4,
      dry_run: summary.dry_run,
      error_count: summary.errors.length,
    }),
  );
  if (summary.errors.length) {
    console.warn("[zoom-sync] errors:", summary.errors);
  }

  process.exit(summary.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error("[zoom-sync] fatal", err);
  process.exit(1);
});
