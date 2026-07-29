import { after } from "next/server";
import { db } from "@/lib/db";
import {
  CALENDAR_EVENTS_TABLE,
  LIVE_CLASS_RECORDINGS_TABLE,
} from "@/lib/db/schema";
import {
  buildLiveClassRecordingPath,
  getGcpSignedUrl,
  streamUploadToGcp,
} from "@/lib/gcp/storage";
import { markRecordingJobRetryOrFail } from "@/lib/jobs/recordingQueue";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";
import {
  getZoomMeetingRecordings,
  openZoomRecordingDownloadStream,
  pickPrimaryZoomRecordingFile,
  type ZoomMeetingRecordings,
} from "@/lib/zoom/client";

export type LiveClassRecordingRow = {
  id: string;
  event_id: string;
  treatment_id: string;
  course_id: string | null;
  title: string | null;
  gcp_path: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  size_bytes: number | null;
  mime_type: string | null;
  zoom_meeting_id: string | null;
  zoom_recording_id: string | null;
  zoom_file_id: string | null;
  status: string;
  error_message: string | null;
  attempt_count?: number;
  max_attempts?: number;
  next_attempt_at?: string;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at: string;
  updated_at: string;
  event_title?: string;
  treatment_name?: string;
  signed_video_url?: string | null;
};

type EventForRecording = {
  id: string;
  title: string;
  treatment_id: string | null;
  course_id: string | null;
  meeting_id: string | null;
  meeting_url: string | null;
  recording_status: string;
  live_class_recording_id: string | null;
  status: string;
};

function resolveMeetingId(event: EventForRecording): string {
  if (event.meeting_id?.trim()) {
    return event.meeting_id.replace(/\s+/g, "");
  }
  return parseZoomJoinUrl(event.meeting_url || "").meeting_id;
}

async function getEventForRecording(
  eventId: string,
): Promise<EventForRecording | null> {
  const [rows] = await db.query<EventForRecording>(
    `SELECT id, title, treatment_id, course_id, meeting_id, meeting_url,
            recording_status, live_class_recording_id, status
     FROM ${CALENDAR_EVENTS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL AND type = 'live_class'`,
    [eventId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

export async function listRecordingsForEvent(eventId: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE}
     WHERE event_id = $1
     ORDER BY created_at DESC`,
    [eventId],
  );
  const items = Array.isArray(rows) ? rows : [];
  return Promise.all(
    items.map(async (r) => ({
      ...r,
      signed_video_url:
        r.status === "ready" && r.video_url
          ? await getGcpSignedUrl(r.video_url)
          : null,
    })),
  );
}

export async function listRecordingsForTreatment(treatmentId: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT r.*, ce.title AS event_title
     FROM ${LIVE_CLASS_RECORDINGS_TABLE} r
     JOIN ${CALENDAR_EVENTS_TABLE} ce ON ce.id = r.event_id
     WHERE r.treatment_id = $1 AND r.status = 'ready' AND ce.deleted_at IS NULL
     ORDER BY r.created_at DESC`,
    [treatmentId],
  );
  const items = Array.isArray(rows) ? rows : [];
  return Promise.all(
    items.map(async (r) => ({
      ...r,
      signed_video_url: r.video_url
        ? await getGcpSignedUrl(r.video_url)
        : null,
    })),
  );
}

async function setEventRecordingStatus(
  eventId: string,
  status: "pending" | "processing" | "ready" | "failed",
  liveClassRecordingId?: string | null,
) {
  if (status === "ready" && liveClassRecordingId) {
    await db.query(
      `UPDATE ${CALENDAR_EVENTS_TABLE}
       SET recording_status = 'ready',
           live_class_recording_id = $2,
           status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END,
           updated_at = now()
       WHERE id = $1`,
      [eventId, liveClassRecordingId],
    );
    return;
  }

  await db.query(
    `UPDATE ${CALENDAR_EVENTS_TABLE}
     SET recording_status = $2,
         updated_at = now()
     WHERE id = $1`,
    [eventId, status],
  );
}

async function findReadyByZoomFileId(zoomFileId: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE}
     WHERE zoom_file_id = $1 AND status = 'ready'
     LIMIT 1`,
    [zoomFileId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findReadyByEventId(eventId: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE}
     WHERE event_id = $1 AND status = 'ready'
     ORDER BY created_at DESC
     LIMIT 1`,
    [eventId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function findActiveQueueJob(eventId: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE}
     WHERE event_id = $1 AND status IN ('pending', 'processing')
     ORDER BY
       CASE status WHEN 'processing' THEN 0 ELSE 1 END,
       created_at DESC
     LIMIT 1`,
    [eventId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

async function getRecordingById(id: string) {
  const [rows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE} WHERE id = $1`,
    [id],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

function kickRecordingWorker() {
  after(async () => {
    try {
      const { processAvailableRecordingJobs } = await import(
        "@/lib/jobs/recordingWorker"
      );
      await processAvailableRecordingJobs();
    } catch (err) {
      console.error("[recording] worker kick failed", err);
    }
  });
}

/**
 * Process a claimed recording job: stream Zoom → GCP.
 * Prefer calling via the queue worker (claim first). Retries on transient failure.
 */
export async function processRecordingJob(
  recordingId: string,
  opts?: {
    recordingsPayload?: ZoomMeetingRecordings;
    workerId?: string;
  },
): Promise<LiveClassRecordingRow> {
  const job = await getRecordingById(recordingId);
  if (!job) throw new Error("Recording job not found");
  if (job.status === "ready") return job;

  const event = await getEventForRecording(job.event_id);
  if (!event) throw new Error("Live class not found");
  if (!event.treatment_id) {
    throw new Error("Live class has no treatment_id");
  }

  const meetingId = job.zoom_meeting_id || resolveMeetingId(event);
  if (!meetingId) {
    throw new Error("No Zoom meeting ID on this live class");
  }

  await setEventRecordingStatus(event.id, "processing");

  try {
    // Always prefer live Zoom API for download tokens (webhook tokens expire).
    let recordings = await getZoomMeetingRecordings(meetingId);
    let file = pickPrimaryZoomRecordingFile(recordings.recording_files);

    if (!file?.download_url && opts?.recordingsPayload) {
      recordings = opts.recordingsPayload;
      file = pickPrimaryZoomRecordingFile(recordings.recording_files);
    }

    if (!file?.download_url) {
      throw new Error("No Zoom recording file available yet");
    }

    if (file.id) {
      const byFile = await findReadyByZoomFileId(file.id);
      if (byFile && byFile.id !== recordingId) {
        await setEventRecordingStatus(event.id, "ready", byFile.id);
        await db.query(
          `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
           SET status = 'ready',
               gcp_path = $2,
               video_url = $3,
               zoom_file_id = COALESCE($4, zoom_file_id),
               locked_at = NULL,
               locked_by = NULL,
               error_message = NULL,
               updated_at = now()
           WHERE id = $1`,
          [recordingId, byFile.gcp_path, byFile.video_url, file.id],
        );
        return (await getRecordingById(recordingId))!;
      }
    }

    let streamResult: {
      stream: NodeJS.ReadableStream;
      contentType: string;
    };
    try {
      streamResult = await openZoomRecordingDownloadStream(
        file.download_url,
        recordings.download_access_token,
      );
    } catch (downloadErr) {
      console.warn(
        "[recording] download with token failed; refetching Zoom metadata",
        downloadErr,
      );
      recordings = await getZoomMeetingRecordings(meetingId);
      file = pickPrimaryZoomRecordingFile(recordings.recording_files);
      if (!file?.download_url) throw downloadErr;
      streamResult = await openZoomRecordingDownloadStream(
        file.download_url,
        recordings.download_access_token,
      );
    }

    const { stream, contentType } = streamResult;

    const ext =
      (file.file_extension || "mp4").replace(/^\./, "").toLowerCase() || "mp4";
    const destination = buildLiveClassRecordingPath({
      treatmentId: event.treatment_id,
      eventId: event.id,
      fileName: `recording.${ext}`,
    });

    const uploaded = await streamUploadToGcp({
      readable: stream,
      destination,
      contentType: contentType || `video/${ext}`,
    });

    const durationSeconds =
      file.recording_start && file.recording_end
        ? Math.max(
            0,
            Math.round(
              (new Date(file.recording_end).getTime() -
                new Date(file.recording_start).getTime()) /
                1000,
            ),
          )
        : recordings.duration
          ? recordings.duration * 60
          : null;

    const [updated] = await db.query<LiveClassRecordingRow>(
      `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
       SET gcp_path = $2,
           video_url = $3,
           duration_seconds = $4,
           size_bytes = $5,
           mime_type = $6,
           zoom_meeting_id = $7,
           zoom_recording_id = $8,
           zoom_file_id = COALESCE($9, zoom_file_id),
           status = 'ready',
           locked_at = NULL,
           locked_by = NULL,
           error_message = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [
        recordingId,
        uploaded.path,
        uploaded.url,
        durationSeconds,
        file.file_size ?? null,
        contentType || `video/${ext}`,
        String(recordings.id || meetingId),
        recordings.uuid || null,
        file.id || null,
      ],
    );

    const row = Array.isArray(updated) ? updated[0] : null;
    if (!row) throw new Error("Failed to update recording after upload");

    await setEventRecordingStatus(event.id, "ready", row.id);
    console.info(
      `[recording] ready event=${event.id} recording=${row.id} path=${uploaded.path}`,
    );
    return row;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Recording ingest failed";
    const outcome = await markRecordingJobRetryOrFail(recordingId, message);
    // Always surface failure on the calendar so admin UI is not stuck on "Uploading…"
    await setEventRecordingStatus(event.id, "failed");
    if (outcome === "retry") {
      console.warn(
        `[recording] retry scheduled job=${recordingId}: ${message}`,
      );
    }
    console.error(`[recording] failed job=${recordingId}`, err);
    throw err;
  }
}

/**
 * Enqueue Zoom→GCP ingest into the durable Postgres queue and kick a worker.
 */
export async function enqueueRecordingIngest(
  eventId: string,
  _opts?: { recordingsPayload?: ZoomMeetingRecordings },
): Promise<{
  row: LiveClassRecordingRow;
  enqueued: boolean;
  already_ready: boolean;
}> {
  const event = await getEventForRecording(eventId);
  if (!event) throw new Error("Live class not found");
  if (!event.treatment_id) {
    throw new Error("Live class has no treatment_id — cannot store recording");
  }

  const existingReady = await findReadyByEventId(eventId);
  if (existingReady) {
    if (!event.live_class_recording_id) {
      await setEventRecordingStatus(eventId, "ready", existingReady.id);
    }
    return { row: existingReady, enqueued: false, already_ready: true };
  }

  const meetingId = resolveMeetingId(event);
  if (!meetingId) {
    throw new Error("No Zoom meeting ID on this live class");
  }

  const active = await findActiveQueueJob(eventId);
  if (active) {
    // Already queued or running — wake worker; only show "processing" while claimed
    if (active.status === "processing" && active.locked_at) {
      await setEventRecordingStatus(eventId, "processing");
    } else {
      // Pending backoff / unlocked — do not lock the Sync button as "Uploading…"
      await setEventRecordingStatus(eventId, "failed");
    }
    kickRecordingWorker();
    return { row: active, enqueued: false, already_ready: false };
  }

  // Re-queue latest failed job, or insert a new pending job
  const [failedRows] = await db.query<LiveClassRecordingRow>(
    `SELECT * FROM ${LIVE_CLASS_RECORDINGS_TABLE}
     WHERE event_id = $1 AND status = 'failed'
     ORDER BY created_at DESC
     LIMIT 1`,
    [eventId],
  );
  const failed = Array.isArray(failedRows) ? failedRows[0] : null;

  let job: LiveClassRecordingRow | null = null;
  let shouldSchedule = false;

  if (failed) {
    const [updated] = await db.query<LiveClassRecordingRow>(
      `UPDATE ${LIVE_CLASS_RECORDINGS_TABLE}
       SET status = 'pending',
           attempt_count = 0,
           next_attempt_at = now(),
           locked_at = NULL,
           locked_by = NULL,
           error_message = NULL,
           zoom_meeting_id = COALESCE($2, zoom_meeting_id),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [failed.id, meetingId],
    );
    job = Array.isArray(updated) ? updated[0] : null;
    shouldSchedule = true;
  } else {
    const [inserted] = await db.query<LiveClassRecordingRow>(
      `INSERT INTO ${LIVE_CLASS_RECORDINGS_TABLE} (
         event_id, treatment_id, course_id, title, status, zoom_meeting_id,
         attempt_count, next_attempt_at
       ) VALUES ($1, $2, $3, $4, 'pending', $5, 0, now())
       RETURNING *`,
      [
        event.id,
        event.treatment_id,
        event.course_id,
        event.title,
        meetingId,
      ],
    );
    job = Array.isArray(inserted) ? inserted[0] : null;
    shouldSchedule = true;
  }

  if (!job) throw new Error("Failed to create recording job");

  // Calendar stays pending until the worker claims the job (then processing).
  await setEventRecordingStatus(eventId, "pending");

  if (shouldSchedule) {
    kickRecordingWorker();
  }

  return {
    row: job,
    enqueued: shouldSchedule,
    already_ready: false,
  };
}

/** Enqueue only (does not wait for upload). Prefer this from APIs/webhooks. */
export async function ingestZoomRecordingForEvent(
  eventId: string,
  opts?: { recordingsPayload?: ZoomMeetingRecordings },
): Promise<LiveClassRecordingRow> {
  const result = await enqueueRecordingIngest(eventId, opts);
  return result.row;
}

/**
 * Webhook: resolve event, enqueue durable background upload, return quickly.
 */
export async function enqueueFromZoomRecordingCompleted(payload: {
  object?: {
    id?: string | number;
    uuid?: string;
    topic?: string;
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
    download_access_token?: string;
  };
}): Promise<{
  event_id: string;
  recording_id: string;
  enqueued: boolean;
} | null> {
  const meetingId =
    payload.object?.id != null ? String(payload.object.id) : "";
  if (!meetingId) {
    console.warn("[recording] recording.completed without meeting id");
    return null;
  }

  const [rows] = await db.query<{ id: string }>(
    `SELECT id FROM ${CALENDAR_EVENTS_TABLE}
     WHERE deleted_at IS NULL
       AND type = 'live_class'
       AND (
         REPLACE(COALESCE(meeting_id, ''), ' ', '') = $1
         OR meeting_url ILIKE '%' || $1 || '%'
       )
     ORDER BY starts_at DESC
     LIMIT 1`,
    [meetingId.replace(/\s+/g, "")],
  );
  const eventId = Array.isArray(rows) ? rows[0]?.id : null;
  if (!eventId) {
    console.info(
      `[recording] No live class for Zoom meeting ${meetingId} — skipped`,
    );
    return null;
  }

  // Payload tokens expire; queue worker always refetches from Zoom API.
  const result = await enqueueRecordingIngest(eventId);

  return {
    event_id: eventId,
    recording_id: result.row.id,
    enqueued: result.enqueued,
  };
}

/** @deprecated use enqueueFromZoomRecordingCompleted */
export async function ingestFromZoomRecordingCompleted(
  payload: Parameters<typeof enqueueFromZoomRecordingCompleted>[0],
): Promise<LiveClassRecordingRow | null> {
  const result = await enqueueFromZoomRecordingCompleted(payload);
  if (!result) return null;
  return getRecordingById(result.recording_id);
}

export async function markLiveClassMeetingEnded(meetingId: string) {
  const id = meetingId.replace(/\s+/g, "");
  await db.query(
    `UPDATE ${CALENDAR_EVENTS_TABLE}
     SET status = CASE WHEN status = 'cancelled' THEN status ELSE 'completed' END,
         updated_at = now()
     WHERE deleted_at IS NULL
       AND type = 'live_class'
       AND (
         REPLACE(COALESCE(meeting_id, ''), ' ', '') = $1
         OR meeting_url ILIKE '%' || $1 || '%'
       )
       AND status IN ('scheduled', 'live')`,
    [id],
  );
}
