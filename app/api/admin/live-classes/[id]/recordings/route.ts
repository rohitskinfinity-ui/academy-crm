import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  enqueueRecordingIngest,
  listRecordingsForEvent,
} from "@/lib/services/admin/liveClassRecordingService";

type Ctx = { params: Promise<{ id: string }> };

function recordingSyncEnabled() {
  return process.env.RECORDING_SYNC_ENABLED === "1";
}

/** List recordings for a live class (with signed watch URLs when ready). */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    if (!recordingSyncEnabled()) {
      return apiSuccess(
        { items: [], disabled: true },
        "Recording sync disabled",
      );
    }
    const { id } = await context.params;
    const items = await listRecordingsForEvent(id);
    return apiSuccess({ items }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * POST — enqueue durable Zoom→GCP job (Postgres queue + worker).
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    if (!recordingSyncEnabled()) {
      return apiError(
        "Recording sync is temporarily disabled. Set RECORDING_SYNC_ENABLED=1 to re-enable.",
        503,
      );
    }
    const { id } = await context.params;
    const result = await enqueueRecordingIngest(id);
    return apiSuccess(
      {
        recording: result.row,
        enqueued: result.enqueued,
        already_ready: result.already_ready,
      },
      result.already_ready
        ? "Recording already ready"
        : result.enqueued
          ? "Recording queued for background ingest"
          : "Recording already queued or processing",
      result.already_ready ? 200 : 202,
    );
  } catch (err) {
    console.error("[live-class recording sync]", err);
    return handleApiError(err);
  }
}
