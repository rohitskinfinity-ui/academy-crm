import { db } from "@/lib/db";
import {
  CALENDAR_EVENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  EVENT_ATTACHMENTS_TABLE,
  EVENT_ATTENDANCE_TABLE,
  EVENT_QUIZ_ATTEMPTS_TABLE,
  EVENT_QUIZ_QUESTIONS_TABLE,
  EVENT_QUIZZES_TABLE,
  EVENT_REMINDERS_TABLE,
  LIVE_CLASS_RECORDINGS_TABLE,
  TREATMENTS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";

export type StudentLiveAttachment = {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size_label: string | null;
};

export type StudentLiveQuiz = {
  id: string;
  title: string;
  pass_percent: number;
  is_required: boolean;
  question_count: number;
};

export type StudentLiveSession = {
  id: string;
  title: string;
  instructor: string;
  starts_at: string;
  ends_at: string | null;
  duration_label: string | null;
  status: "live" | "upcoming" | "completed";
  attendees: number;
  platform: "zoom" | "google_meet";
  meeting_url: string | null;
  drive_url: string | null;
  booklet_label: string | null;
  treatment_id: string;
  treatment_name: string | null;
  course_id: string | null;
  course_title: string | null;
  enrollment_id: string | null;
  recording_status: "pending" | "processing" | "ready" | "failed";
  recording_title: string | null;
  recording_id: string | null;
  recurrence_rule: string | null;
  series_id: string | null;
  reminded: boolean;
  attachments: StudentLiveAttachment[];
  quiz: StudentLiveQuiz | null;
  quiz_attempt_passed: boolean;
};

type LiveRow = {
  id: string;
  title: string;
  instructor: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_label: string | null;
  event_status: string;
  attendees: string;
  platform: string;
  meeting_url: string | null;
  drive_url: string | null;
  booklet_label: string | null;
  treatment_id: string;
  treatment_name: string | null;
  course_id: string | null;
  course_title: string | null;
  enrollment_id: string | null;
  recording_status: string | null;
  recording_title: string | null;
  recording_id: string | null;
  recurrence_rule: string | null;
  series_id: string | null;
  reminded: boolean;
  quiz_id: string | null;
  quiz_title: string | null;
  quiz_pass_percent: string | null;
  quiz_is_required: boolean | null;
  quiz_question_count: string | null;
  quiz_attempt_passed: boolean;
};

function formatSize(bytes: number | null | undefined) {
  if (bytes == null || Number.isNaN(bytes) || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function deriveStatus(
  eventStatus: string,
  startsAt: string,
  endsAt: string | null,
): StudentLiveSession["status"] {
  if (eventStatus === "live") return "live";
  if (eventStatus === "completed" || eventStatus === "cancelled") {
    return "completed";
  }
  const start = new Date(startsAt).getTime();
  const end = endsAt
    ? new Date(endsAt).getTime()
    : start + 60 * 60 * 1000;
  const now = Date.now();
  if (!Number.isNaN(start) && now >= start && now <= end) return "live";
  if (!Number.isNaN(end) && now > end) return "completed";
  return "upcoming";
}

function mapSession(
  row: LiveRow,
  attachments: StudentLiveAttachment[],
): StudentLiveSession {
  const platform = row.platform === "google_meet" ? "google_meet" : "zoom";
  const recordingStatus =
    row.recording_status === "ready" ||
    row.recording_status === "processing" ||
    row.recording_status === "failed"
      ? row.recording_status
      : "pending";

  return {
    id: row.id,
    title: row.title,
    instructor: row.instructor?.trim() || "Faculty",
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    duration_label: row.duration_label,
    status: deriveStatus(row.event_status, row.starts_at, row.ends_at),
    attendees: parseInt(row.attendees ?? "0", 10) || 0,
    platform,
    meeting_url: row.meeting_url,
    drive_url: row.drive_url,
    booklet_label: row.booklet_label,
    treatment_id: row.treatment_id,
    treatment_name: row.treatment_name,
    course_id: row.course_id,
    course_title: row.course_title,
    enrollment_id: row.enrollment_id,
    recording_status: recordingStatus,
    recording_title: row.recording_title,
    recording_id: row.recording_id,
    recurrence_rule: row.recurrence_rule,
    series_id: row.series_id,
    reminded: Boolean(row.reminded),
    attachments,
    quiz: row.quiz_id
      ? {
          id: row.quiz_id,
          title: row.quiz_title || "Live class quiz",
          pass_percent: Number(row.quiz_pass_percent ?? 66),
          is_required: Boolean(row.quiz_is_required),
          question_count: parseInt(row.quiz_question_count ?? "0", 10) || 0,
        }
      : null,
    quiz_attempt_passed: Boolean(row.quiz_attempt_passed),
  };
}

async function loadAttachments(eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, StudentLiveAttachment[]>();
  const [rows] = await db.query<{
    id: string;
    event_id: string;
    file_name: string;
    file_url: string;
    mime_type: string | null;
    size_bytes: string | null;
  }>(
    `SELECT id, event_id, file_name, file_url, mime_type, size_bytes::text
     FROM ${EVENT_ATTACHMENTS_TABLE}
     WHERE event_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [eventIds],
  );
  const map = new Map<string, StudentLiveAttachment[]>();
  for (const row of Array.isArray(rows) ? rows : []) {
    const list = map.get(row.event_id) ?? [];
    list.push({
      id: row.id,
      file_name: row.file_name,
      file_url: row.file_url,
      mime_type: row.mime_type,
      size_label: formatSize(row.size_bytes ? Number(row.size_bytes) : null),
    });
    map.set(row.event_id, list);
  }
  return map;
}

async function queryStudentLiveRows(userId: string, eventId?: string) {
  const params: unknown[] = [userId];
  const eventFilter = eventId
    ? `AND ce.id = $${params.push(eventId)}`
    : "";

  const [rows] = await db.query<LiveRow>(
    `SELECT
       ce.id,
       ce.title,
       COALESCE(u.full_name, ce.category_label, 'Faculty') AS instructor,
       ce.starts_at::text AS starts_at,
       ce.ends_at::text AS ends_at,
       ce.duration_label,
       ce.status::text AS event_status,
       (
         SELECT COUNT(*)::text FROM ${EVENT_ATTENDANCE_TABLE} ea
         WHERE ea.event_id = ce.id
       ) AS attendees,
       ce.platform::text AS platform,
       ce.meeting_url,
       ce.drive_url,
       ce.booklet_label,
       ce.treatment_id,
       t.name AS treatment_name,
       ce.course_id,
       c.title AS course_title,
       e.enrollment_id,
       ce.recording_status::text AS recording_status,
       lcr.title AS recording_title,
       ce.live_class_recording_id::text AS recording_id,
       ce.recurrence_rule,
       ce.series_id::text AS series_id,
       EXISTS (
         SELECT 1 FROM ${EVENT_REMINDERS_TABLE} er
         WHERE er.event_id = ce.id AND er.user_id = $1
       ) AS reminded,
       eq.id AS quiz_id,
       eq.title AS quiz_title,
       eq.pass_percent::text AS quiz_pass_percent,
       eq.is_required AS quiz_is_required,
       (
         SELECT COUNT(*)::text FROM ${EVENT_QUIZ_QUESTIONS_TABLE} eqq
         WHERE eqq.quiz_id = eq.id
       ) AS quiz_question_count,
       EXISTS (
         SELECT 1 FROM ${EVENT_QUIZ_ATTEMPTS_TABLE} eqa
         WHERE eqa.quiz_id = eq.id AND eqa.user_id = $1 AND eqa.passed = true
       ) AS quiz_attempt_passed
     FROM ${CALENDAR_EVENTS_TABLE} ce
     JOIN LATERAL (
       SELECT en.id AS enrollment_id, en.course_id
       FROM ${ENROLLMENTS_TABLE} en
       WHERE en.user_id = $1
         AND en.deleted_at IS NULL
         AND en.status IN ('active', 'completed')
         AND en.course_id IS NOT NULL
         AND en.course_id = ce.course_id
         AND (ce.batch_id IS NULL OR en.batch_id IS NULL OR ce.batch_id = en.batch_id)
       ORDER BY en.created_at DESC
       LIMIT 1
     ) e ON true
     LEFT JOIN ${USERS_TABLE} u ON u.id = ce.instructor_id AND u.deleted_at IS NULL
     LEFT JOIN ${TREATMENTS_TABLE} t ON t.id = ce.treatment_id
     LEFT JOIN ${COURSES_TABLE} c ON c.id = ce.course_id
     LEFT JOIN ${LIVE_CLASS_RECORDINGS_TABLE} lcr ON lcr.id = ce.live_class_recording_id
     LEFT JOIN ${EVENT_QUIZZES_TABLE} eq ON eq.event_id = ce.id
     WHERE ce.type = 'live_class'
       AND ce.deleted_at IS NULL
       AND ce.is_published = true
       AND ce.status <> 'cancelled'
       ${eventFilter}
     ORDER BY ce.starts_at ASC`,
    params,
  );

  return Array.isArray(rows) ? rows : [];
}

export async function listStudentLiveClasses(userId: string) {
  const rows = await queryStudentLiveRows(userId);
  const attachments = await loadAttachments(rows.map((r) => r.id));
  const sessions = rows.map((row) =>
    mapSession(row, attachments.get(row.id) ?? []),
  );

  const liveNow =
    sessions.find((s) => s.status === "live") ?? null;
  const upcoming = sessions.filter((s) => s.status === "upcoming");
  const past = sessions
    .filter((s) => s.status === "completed")
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));

  return {
    live_now: liveNow,
    upcoming,
    past,
  };
}

export async function getAccessibleLiveClass(userId: string, eventId: string) {
  const rows = await queryStudentLiveRows(userId, eventId);
  const row = rows[0];
  if (!row) {
    throw Object.assign(new Error("Live class not found"), { status: 404 });
  }
  const attachments = await loadAttachments([row.id]);
  return mapSession(row, attachments.get(row.id) ?? []);
}

export async function setStudentLiveReminder(
  userId: string,
  eventId: string,
  reminded?: boolean,
) {
  const session = await getAccessibleLiveClass(userId, eventId);
  const next =
    reminded !== undefined ? reminded : !session.reminded;

  if (next) {
    await db.query(
      `INSERT INTO ${EVENT_REMINDERS_TABLE} (event_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (event_id, user_id) DO NOTHING`,
      [eventId, userId],
    );
  } else {
    await db.query(
      `DELETE FROM ${EVENT_REMINDERS_TABLE}
       WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId],
    );
  }

  return { event_id: eventId, reminded: next };
}
