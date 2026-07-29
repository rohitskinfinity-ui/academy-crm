import { db } from "@/lib/db";
import {
  CALENDAR_EVENTS_TABLE,
  ENROLLMENTS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { markAttendance } from "@/lib/services/admin/attendanceService";
import { getLiveClassJoinWindow } from "@/lib/liveClassJoinWindow";
import {
  addZoomMeetingRegistrant,
} from "@/lib/zoom/client";
import { parseZoomJoinUrl } from "@/lib/zoom/parseJoinUrl";

export type LiveClassJoinEvent = {
  id: string;
  title: string;
  meeting_url: string | null;
  meeting_id: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_label: string | null;
  course_id: string | null;
  batch_id: string | null;
  status: string;
  platform: string | null;
};

export type EnrolledStudent = {
  user_id: string;
  email: string;
  full_name: string;
};

export { getLiveClassJoinWindow } from "@/lib/liveClassJoinWindow";

export async function getLiveClassForJoin(
  id: string,
): Promise<LiveClassJoinEvent | null> {
  const [rows] = await db.query<LiveClassJoinEvent>(
    `SELECT id, title, meeting_url, meeting_id, starts_at, ends_at,
            duration_label, course_id, batch_id, status, platform
     FROM ${CALENDAR_EVENTS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL AND type = 'live_class'`,
    [id],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

export async function findLiveClassByMeetingId(
  meetingId: string,
): Promise<LiveClassJoinEvent | null> {
  const id = meetingId.replace(/\s+/g, "");
  if (!id) return null;

  const [rows] = await db.query<LiveClassJoinEvent>(
    `SELECT id, title, meeting_url, meeting_id, starts_at, ends_at,
            duration_label, course_id, batch_id, status, platform
     FROM ${CALENDAR_EVENTS_TABLE}
     WHERE deleted_at IS NULL
       AND type = 'live_class'
       AND (
         REPLACE(COALESCE(meeting_id, ''), ' ', '') = $1
         OR meeting_url ILIKE '%' || $1 || '%'
       )
     ORDER BY starts_at DESC
     LIMIT 1`,
    [id],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const [rows] = await db.query<{ id: string }>(
    `SELECT id FROM ${USERS_TABLE}
     WHERE lower(email::text) = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [normalized],
  );
  return Array.isArray(rows) ? (rows[0]?.id ?? null) : null;
}

export async function getUserProfile(userId: string): Promise<{
  id: string;
  email: string;
  full_name: string;
} | null> {
  const [rows] = await db.query<{
    id: string;
    email: string;
    full_name: string;
  }>(
    `SELECT id, email::text AS email, full_name
     FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

/**
 * Enrolled in the live class course (and batch when the event is batch-scoped).
 */
export async function isUserEnrolledInLiveClass(
  userId: string,
  event: Pick<LiveClassJoinEvent, "course_id" | "batch_id">,
): Promise<boolean> {
  if (!event.course_id) return false;

  const params: unknown[] = [userId, event.course_id];
  let batchClause = "";
  if (event.batch_id) {
    batchClause = ` AND (e.batch_id = $3 OR e.batch_id IS NULL)`;
    params.push(event.batch_id);
  }

  const [rows] = await db.query<{ id: string }>(
    `SELECT e.id FROM ${ENROLLMENTS_TABLE} e
     WHERE e.user_id = $1
       AND e.course_id = $2
       AND e.status IN ('active', 'completed')
       AND e.deleted_at IS NULL
       ${batchClause}
     LIMIT 1`,
    params,
  );
  return Array.isArray(rows) && !!rows[0];
}

/** @deprecated use isUserEnrolledInLiveClass */
export async function isUserEnrolledInCourse(
  userId: string,
  courseId: string | null,
): Promise<boolean> {
  if (!courseId) return false;
  return isUserEnrolledInLiveClass(userId, {
    course_id: courseId,
    batch_id: null,
  });
}

export async function listEnrolledStudentsForLiveClass(
  event: Pick<LiveClassJoinEvent, "course_id" | "batch_id">,
): Promise<EnrolledStudent[]> {
  if (!event.course_id) return [];

  const params: unknown[] = [event.course_id];
  let batchClause = "";
  if (event.batch_id) {
    batchClause = ` AND (e.batch_id = $2 OR e.batch_id IS NULL)`;
    params.push(event.batch_id);
  }

  const [rows] = await db.query<EnrolledStudent>(
    `SELECT DISTINCT u.id AS user_id, u.email::text AS email, u.full_name
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id AND u.deleted_at IS NULL
     WHERE e.course_id = $1
       AND e.status IN ('active', 'completed')
       AND e.deleted_at IS NULL
       AND u.email IS NOT NULL
       ${batchClause}
     ORDER BY u.full_name ASC`,
    params,
  );
  return Array.isArray(rows) ? rows : [];
}

export function resolveMeetingId(event: LiveClassJoinEvent): string {
  if (event.meeting_id?.trim()) {
    return event.meeting_id.replace(/\s+/g, "");
  }
  return parseZoomJoinUrl(event.meeting_url || "").meeting_id;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "Student", last: "Student" };
  if (parts.length === 1) return { first: parts[0], last: "Student" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Enrollment-gated join URL for one student.
 * Prefers Zoom registrant personal join_url when meeting_id exists.
 */
export async function resolveEnrolledStudentJoinUrl(opts: {
  event: LiveClassJoinEvent;
  userId: string;
  markAttendance?: boolean;
}): Promise<{
  ok: boolean;
  reason: string;
  meeting_url: string | null;
  attendance_marked: boolean;
}> {
  const window = getLiveClassJoinWindow(opts.event);
  if (!window.can_join) {
    return {
      ok: false,
      reason: window.reason,
      meeting_url: null,
      attendance_marked: false,
    };
  }

  const enrolled = await isUserEnrolledInLiveClass(opts.userId, opts.event);
  if (!enrolled) {
    return {
      ok: false,
      reason: "not_enrolled",
      meeting_url: null,
      attendance_marked: false,
    };
  }

  const profile = await getUserProfile(opts.userId);
  if (!profile?.email) {
    return {
      ok: false,
      reason: "no_email",
      meeting_url: null,
      attendance_marked: false,
    };
  }

  let meetingUrl = opts.event.meeting_url;
  const meetingId = resolveMeetingId(opts.event);
  const isZoom =
    !opts.event.platform || opts.event.platform === "zoom";

  if (isZoom && meetingId && process.env.ZOOM_SYNC_REGISTRANTS !== "false") {
    try {
      const { first, last } = splitName(profile.full_name || "Student");
      const registrant = await addZoomMeetingRegistrant(meetingId, {
        email: profile.email,
        first_name: first,
        last_name: last,
      });
      meetingUrl = registrant.join_url;
    } catch (err) {
      console.warn(
        "[join] Zoom registrant failed; falling back to meeting_url",
        err,
      );
    }
  }

  let attendance_marked = false;
  if (opts.markAttendance !== false) {
    await markAttendance({
      event_id: opts.event.id,
      user_id: opts.userId,
    });
    attendance_marked = true;
  }

  return {
    ok: true,
    reason: "ok",
    meeting_url: meetingUrl,
    attendance_marked,
  };
}

/**
 * Mark attendance only when join window is open and user is enrolled.
 */
export async function markLiveAttendanceOnJoin(opts: {
  event: LiveClassJoinEvent;
  userId: string;
  checkedInAt?: string;
}): Promise<{ marked: boolean; reason: string }> {
  const window = getLiveClassJoinWindow(opts.event);
  if (!window.can_join) {
    return { marked: false, reason: window.reason };
  }

  const enrolled = await isUserEnrolledInLiveClass(opts.userId, opts.event);
  if (!enrolled) {
    return { marked: false, reason: "not_enrolled" };
  }

  await markAttendance({
    event_id: opts.event.id,
    user_id: opts.userId,
    checked_in_at: opts.checkedInAt,
  });
  return { marked: true, reason: "ok" };
}

export async function syncZoomRegistrantsForLiveClass(
  eventId: string,
): Promise<{
  meeting_id: string;
  total_enrolled: number;
  synced: number;
  failed: Array<{ email: string; error: string }>;
}> {
  const event = await getLiveClassForJoin(eventId);
  if (!event) throw new Error("Live class not found");

  const meetingId = resolveMeetingId(event);
  if (!meetingId) {
    throw new Error("No Zoom meeting ID — generate or paste a Zoom link first");
  }
  if (event.platform && event.platform !== "zoom") {
    throw new Error("Registrant sync is only for Zoom meetings");
  }
  if (!event.course_id) {
    throw new Error("Link this live class to a course before syncing registrants");
  }

  const students = await listEnrolledStudentsForLiveClass(event);
  let synced = 0;
  const failed: Array<{ email: string; error: string }> = [];

  for (const s of students) {
    try {
      const { first, last } = splitName(s.full_name || "Student");
      await addZoomMeetingRegistrant(meetingId, {
        email: s.email,
        first_name: first,
        last_name: last,
      });
      synced += 1;
    } catch (err) {
      failed.push({
        email: s.email,
        error: err instanceof Error ? err.message : "Failed",
      });
    }
  }

  return {
    meeting_id: meetingId,
    total_enrolled: students.length,
    synced,
    failed,
  };
}
