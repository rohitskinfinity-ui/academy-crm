import { db } from "@/lib/db";
import {
  CALENDAR_EVENTS_TABLE,
  ENROLLMENTS_TABLE,
  EVENT_ATTENDANCE_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";

export async function listEventAttendance(eventId: string) {
  const [rows] = await db.query(
    `SELECT ea.*, u.full_name, u.email
     FROM ${EVENT_ATTENDANCE_TABLE} ea
     JOIN ${USERS_TABLE} u ON u.id = ea.user_id
     WHERE ea.event_id = $1
     ORDER BY ea.checked_in_at DESC`,
    [eventId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function markAttendance(input: {
  event_id: string;
  user_id: string;
  checked_in_at?: string;
}) {
  const [rows] = await db.query(
    `INSERT INTO ${EVENT_ATTENDANCE_TABLE} (event_id, user_id, checked_in_at)
     VALUES ($1, $2, COALESCE($3::timestamptz, now()))
     ON CONFLICT (event_id, user_id) DO UPDATE SET checked_in_at = EXCLUDED.checked_in_at
     RETURNING *`,
    [input.event_id, input.user_id, input.checked_in_at ?? null],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function removeAttendance(eventId: string, userId: string) {
  const [rows] = await db.query(
    `DELETE FROM ${EVENT_ATTENDANCE_TABLE}
     WHERE event_id = $1 AND user_id = $2
     RETURNING id`,
    [eventId, userId],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function listEnrollmentAttendance(enrollmentId: string) {
  const [enrollmentRows] = await db.query<{
    user_id: string;
    course_id: string | null;
    batch_id: string | null;
  }>(
    `SELECT user_id, course_id, batch_id FROM ${ENROLLMENTS_TABLE} WHERE id = $1`,
    [enrollmentId],
  );
  const enrollment = Array.isArray(enrollmentRows) ? enrollmentRows[0] : null;
  if (!enrollment?.course_id) return { live: [], hands_on: [] };

  const [events] = await db.query<{ id: string; type: string; title: string }>(
    `SELECT id, type, title FROM ${CALENDAR_EVENTS_TABLE}
     WHERE course_id = $1 AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR batch_id = $2 OR batch_id IS NULL)
     ORDER BY starts_at`,
    [enrollment.course_id, enrollment.batch_id],
  );
  const eventList = Array.isArray(events) ? events : [];

  const [attendance] = await db.query(
    `SELECT ea.*, ce.type, ce.title AS event_title
     FROM ${EVENT_ATTENDANCE_TABLE} ea
     JOIN ${CALENDAR_EVENTS_TABLE} ce ON ce.id = ea.event_id
     WHERE ea.user_id = $1 AND ce.course_id = $2`,
    [enrollment.user_id, enrollment.course_id],
  );
  const attendanceList = (Array.isArray(attendance) ? attendance : []) as Array<{
    type: string;
    event_title: string;
  }>;

  return {
    events: eventList,
    attendance: attendanceList,
    live: attendanceList.filter((a) => a.type === "live_class"),
    hands_on: attendanceList.filter((a) => a.type === "workshop"),
  };
}

export async function listCourseEventsForAttendance(
  courseId: string,
  type?: "live_class" | "workshop",
) {
  const where = ["deleted_at IS NULL", "course_id = $1"];
  const params: unknown[] = [courseId];
  if (type) {
    where.push(`type = $${params.length + 1}`);
    params.push(type);
  }

  const [rows] = await db.query(
    `SELECT id, type, title, starts_at, batch_id
     FROM ${CALENDAR_EVENTS_TABLE}
     WHERE ${where.join(" AND ")}
     ORDER BY starts_at DESC
     LIMIT 100`,
    params,
  );
  return Array.isArray(rows) ? rows : [];
}
