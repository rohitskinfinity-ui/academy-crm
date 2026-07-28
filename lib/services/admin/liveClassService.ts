import { db } from "@/lib/db";
import { CALENDAR_EVENTS_TABLE, COURSES_TABLE, TREATMENTS_TABLE } from "@/lib/db/schema";
import { LiveClassInput } from "@/lib/validations/admin/liveClass";

export type LiveClassRow = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  platform: string;
  meeting_url: string | null;
  drive_url: string | null;
  booklet_label: string | null;
  starts_at: string;
  ends_at: string | null;
  duration_label: string | null;
  status: string;
  course_id: string | null;
  course_title?: string | null;
  treatment_id: string | null;
  treatment_name?: string | null;
  instructor_id: string | null;
  instructor_name?: string | null;
  created_at: string;
  updated_at: string;
};

export async function listLiveClasses(opts: {
  course_id?: string;
  treatment_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 50;
  const where: string[] = ["ce.deleted_at IS NULL", "ce.type = 'live_class'"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.course_id) {
    where.push(`ce.course_id = $${i++}`);
    params.push(opts.course_id);
  }

  if (opts.treatment_id) {
    where.push(`ce.treatment_id = $${i++}`);
    params.push(opts.treatment_id);
  }

  if (opts.status) {
    where.push(`ce.status = $${i++}`);
    params.push(opts.status);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (page - 1) * limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${CALENDAR_EVENTS_TABLE} ce ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows) ? parseInt(countRows[0]?.count ?? "0", 10) : 0;

  const [rows] = await db.query<LiveClassRow>(
    `SELECT 
      ce.id,
      ce.type,
      ce.title,
      ce.description,
      ce.platform,
      ce.meeting_url,
      ce.drive_url,
      ce.booklet_label,
      ce.starts_at,
      ce.ends_at,
      ce.duration_label,
      ce.status,
      ce.course_id,
      c.title AS course_title,
      ce.treatment_id,
      t.name AS treatment_name,
      ce.instructor_id,
      ce.category_label AS instructor_name,
      ce.created_at,
      ce.updated_at
     FROM ${CALENDAR_EVENTS_TABLE} ce
     LEFT JOIN ${COURSES_TABLE} c ON ce.course_id = c.id
     LEFT JOIN ${TREATMENTS_TABLE} t ON ce.treatment_id = t.id
     ${whereSql}
     ORDER BY ce.starts_at ASC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset],
  );

  const items = Array.isArray(rows) ? (rows as LiveClassRow[]) : [];

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getLiveClassById(id: string) {
  const [rows] = await db.query<LiveClassRow>(
    `SELECT 
      ce.id,
      ce.type,
      ce.title,
      ce.description,
      ce.platform,
      ce.meeting_url,
      ce.drive_url,
      ce.booklet_label,
      ce.starts_at,
      ce.ends_at,
      ce.duration_label,
      ce.status,
      ce.course_id,
      c.title AS course_title,
      ce.treatment_id,
      t.name AS treatment_name,
      ce.instructor_id,
      ce.category_label AS instructor_name,
      ce.created_at,
      ce.updated_at
     FROM ${CALENDAR_EVENTS_TABLE} ce
     LEFT JOIN ${COURSES_TABLE} c ON ce.course_id = c.id
     LEFT JOIN ${TREATMENTS_TABLE} t ON ce.treatment_id = t.id
     WHERE ce.id = $1 AND ce.deleted_at IS NULL`,
    [id],
  );
  const items = Array.isArray(rows) ? (rows as LiveClassRow[]) : [];
  return items[0] ?? null;
}

export async function createLiveClass(input: LiveClassInput) {
  const startsAtDate = new Date(input.starts_at);
  const endsAtDate = new Date(startsAtDate.getTime() + input.duration_minutes * 60 * 1000);

  const [rows] = await db.query<LiveClassRow>(
    `INSERT INTO ${CALENDAR_EVENTS_TABLE} (
      type,
      title,
      description,
      platform,
      meeting_url,
      drive_url,
      starts_at,
      ends_at,
      duration_label,
      status,
      course_id,
      treatment_id,
      category_label,
      is_published
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
    RETURNING id, title, starts_at, meeting_url, status`,
    [
      "live_class",
      input.title,
      input.description || null,
      input.platform,
      input.meeting_url,
      input.drive_url || null,
      startsAtDate.toISOString(),
      endsAtDate.toISOString(),
      `${input.duration_minutes} mins`,
      input.status,
      input.course_id || null,
      input.treatment_id || null,
      input.instructor_name,
    ],
  );
  const items = Array.isArray(rows) ? (rows as LiveClassRow[]) : [];
  return items[0];
}

export async function updateLiveClass(id: string, input: Partial<LiveClassInput>) {
  const current = await getLiveClassById(id);
  if (!current) throw new Error("Live class session not found");

  const title = input.title ?? current.title;
  const description = input.description !== undefined ? input.description : current.description;
  const platform = input.platform ?? current.platform;
  const meetingUrl = input.meeting_url ?? current.meeting_url;
  const driveUrl = input.drive_url !== undefined ? input.drive_url : current.drive_url;
  const courseId = input.course_id !== undefined ? input.course_id : current.course_id;
  const treatmentId = input.treatment_id !== undefined ? input.treatment_id : current.treatment_id;
  const instructorName = input.instructor_name ?? current.instructor_name;
  const status = input.status ?? current.status;
  const startsAt = input.starts_at ? new Date(input.starts_at).toISOString() : current.starts_at;

  const [rows] = await db.query<LiveClassRow>(
    `UPDATE ${CALENDAR_EVENTS_TABLE} SET
      title = $1,
      description = $2,
      platform = $3,
      meeting_url = $4,
      drive_url = $5,
      starts_at = $6,
      status = $7,
      course_id = $8,
      treatment_id = $9,
      category_label = $10,
      updated_at = now()
     WHERE id = $11 AND deleted_at IS NULL
     RETURNING id, title, starts_at, meeting_url, status`,
    [
      title,
      description,
      platform,
      meetingUrl,
      driveUrl,
      startsAt,
      status,
      courseId,
      treatmentId,
      instructorName,
      id,
    ],
  );
  const items = Array.isArray(rows) ? (rows as LiveClassRow[]) : [];
  return items[0];
}

export async function deleteLiveClass(id: string) {
  await db.query(
    `UPDATE ${CALENDAR_EVENTS_TABLE} SET deleted_at = now() WHERE id = $1`,
    [id],
  );
  return true;
}
