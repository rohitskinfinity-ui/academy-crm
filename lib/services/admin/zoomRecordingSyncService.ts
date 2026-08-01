import { db } from "@/lib/db";
import { CALENDAR_EVENTS_TABLE } from "@/lib/db/schema";
import {
  createWorkerId,
  recoverStaleRecordingLocks,
} from "@/lib/jobs/recordingQueue";
import { processAvailableRecordingJobs } from "@/lib/jobs/recordingWorker";
import { enqueueRecordingIngest } from "@/lib/services/admin/liveClassRecordingService";
import {
  listZoomUserRecordings,
  pickPrimaryZoomRecordingFile,
  type ZoomUserRecordingsMeeting,
} from "@/lib/zoom/client";

export type ZoomRecordingSyncSummary = {
  from: string;
  to: string;
  timezone: string;
  listed: number;
  matched: number;
  enqueued: number;
  already_ready: number;
  processed: number;
  skipped_orphan: number;
  skipped_no_mp4: number;
  dry_run: boolean;
  errors: string[];
};

function scheduleTimezone(): string {
  return (
    process.env.ZOOM_TIMEZONE?.trim() ||
    process.env.TZ?.trim() ||
    "Asia/Kolkata"
  );
}

function lookbackDays(): number {
  const n = Number(process.env.ZOOM_RECORDING_SYNC_LOOKBACK_DAYS || 2);
  return Number.isFinite(n) && n >= 1 ? Math.min(30, Math.floor(n)) : 2;
}

function maxJobs(): number {
  const n = Number(process.env.ZOOM_RECORDING_SYNC_MAX_JOBS || 20);
  return Number.isFinite(n) && n >= 1 ? Math.min(100, Math.floor(n)) : 20;
}

/** Format a Date as YYYY-MM-DD in the given IANA timezone. */
export function formatDateInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Inclusive lookback window ending today (in schedule TZ).
 * Default: last N calendar days including today.
 */
export function computeRecordingSyncDateRange(
  now = new Date(),
  opts?: { timeZone?: string; lookbackDays?: number },
): { from: string; to: string; timeZone: string } {
  const timeZone = opts?.timeZone || scheduleTimezone();
  const days = opts?.lookbackDays ?? lookbackDays();
  const to = formatDateInTimeZone(now, timeZone);
  const fromDate = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const from = formatDateInTimeZone(fromDate, timeZone);
  return { from, to, timeZone };
}

function meetingHasMp4(meeting: ZoomUserRecordingsMeeting): boolean {
  return Boolean(pickPrimaryZoomRecordingFile(meeting.recording_files));
}

function normalizeMeetingId(value: string | number | undefined | null): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, "");
}

/**
 * Resolve a CRM live_class calendar event for a Zoom meeting id / uuid.
 */
export async function findLiveClassEventForZoomMeeting(opts: {
  meetingId: string;
  meetingUuid?: string | null;
}): Promise<string | null> {
  const meetingId = normalizeMeetingId(opts.meetingId);
  const uuid = opts.meetingUuid?.trim() || "";

  if (!meetingId && !uuid) return null;

  const params: string[] = [];
  const clauses: string[] = [];

  if (meetingId) {
    params.push(meetingId);
    const i = params.length;
    clauses.push(
      `(REPLACE(COALESCE(meeting_id, ''), ' ', '') = $${i} OR meeting_url ILIKE '%' || $${i} || '%')`,
    );
  }
  if (uuid) {
    params.push(uuid);
    const i = params.length;
    clauses.push(
      `(REPLACE(COALESCE(meeting_id, ''), ' ', '') = $${i} OR meeting_url ILIKE '%' || $${i} || '%')`,
    );
  }

  const [rows] = await db.query<{ id: string }>(
    `SELECT id FROM ${CALENDAR_EVENTS_TABLE}
     WHERE deleted_at IS NULL
       AND type = 'live_class'
       AND (${clauses.join(" OR ")})
     ORDER BY starts_at DESC
     LIMIT 1`,
    params,
  );
  return Array.isArray(rows) ? rows[0]?.id ?? null : null;
}

/**
 * Midnight / manual sync: list Zoom cloud recordings → match CRM events →
 * enqueue → drain queue (download → GCS).
 */
export async function runZoomRecordingSync(opts?: {
  dryRun?: boolean;
  from?: string;
  to?: string;
  processJobs?: boolean;
}): Promise<ZoomRecordingSyncSummary> {
  const dryRun = Boolean(opts?.dryRun);
  const processJobs = opts?.processJobs !== false && !dryRun;
  const range = computeRecordingSyncDateRange();
  const from = opts?.from || range.from;
  const to = opts?.to || range.to;
  const timeZone = range.timeZone;

  const summary: ZoomRecordingSyncSummary = {
    from,
    to,
    timezone: timeZone,
    listed: 0,
    matched: 0,
    enqueued: 0,
    already_ready: 0,
    processed: 0,
    skipped_orphan: 0,
    skipped_no_mp4: 0,
    dry_run: dryRun,
    errors: [],
  };

  let meetings: ZoomUserRecordingsMeeting[] = [];
  try {
    meetings = await listZoomUserRecordings({ from, to });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    summary.errors.push(`listZoomUserRecordings: ${message}`);
    return summary;
  }

  summary.listed = meetings.length;

  for (const meeting of meetings) {
    const meetingId = normalizeMeetingId(meeting.id);
    const meetingUuid = meeting.uuid?.trim() || "";

    if (!meetingHasMp4(meeting)) {
      summary.skipped_no_mp4 += 1;
      continue;
    }

    try {
      const eventId = await findLiveClassEventForZoomMeeting({
        meetingId,
        meetingUuid,
      });

      if (!eventId) {
        summary.skipped_orphan += 1;
        console.info(
          `[zoom-sync] orphan meeting=${meetingId || meetingUuid} topic=${meeting.topic ?? ""} — skipped`,
        );
        continue;
      }

      summary.matched += 1;

      if (dryRun) {
        console.info(
          `[zoom-sync] dry-run match event=${eventId} meeting=${meetingId}`,
        );
        continue;
      }

      const result = await enqueueRecordingIngest(eventId);
      if (result.already_ready) {
        summary.already_ready += 1;
      } else if (result.enqueued) {
        summary.enqueued += 1;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      summary.errors.push(
        `meeting=${meetingId || meetingUuid}: ${message}`,
      );
      console.error(
        `[zoom-sync] meeting=${meetingId || meetingUuid} error`,
        err,
      );
    }
  }

  if (processJobs) {
    const recovered = await recoverStaleRecordingLocks();
    if (recovered > 0) {
      console.info(`[zoom-sync] recovered ${recovered} stale lock(s)`);
    }

    const workerId = createWorkerId("midnight-sync");
    const budget = maxJobs();
    let remaining = budget;
    while (remaining > 0) {
      const batch = Math.min(remaining, 1);
      const n = await processAvailableRecordingJobs(batch, workerId);
      if (n === 0) break;
      summary.processed += n;
      remaining -= n;
    }
  }

  return summary;
}
