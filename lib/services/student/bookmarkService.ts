import { db } from "@/lib/db";
import {
  BOOKMARKS_TABLE,
  TREATMENT_VIDEOS_TABLE,
  TREATMENTS_TABLE,
} from "@/lib/db/schema";
import { getOwnedEnrollment } from "./access";

export async function listStudentBookmarks(userId: string) {
  const [rows] = await db.query<{
    id: string;
    enrollment_id: string | null;
    treatment_id: string;
    video_id: string | null;
    title: string;
    module_label: string | null;
    timestamp_seconds: number | null;
    created_at: string;
    treatment_name: string | null;
    video_title: string | null;
  }>(
    `SELECT b.id, b.enrollment_id, b.treatment_id, b.video_id, b.title,
            b.module_label, b.timestamp_seconds, b.created_at::text AS created_at,
            t.name AS treatment_name, tv.title AS video_title
     FROM ${BOOKMARKS_TABLE} b
     LEFT JOIN ${TREATMENTS_TABLE} t ON t.id = b.treatment_id
     LEFT JOIN ${TREATMENT_VIDEOS_TABLE} tv ON tv.id = b.video_id
     WHERE b.user_id = $1 AND b.deleted_at IS NULL
     ORDER BY b.created_at DESC`,
    [userId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createStudentBookmark(
  userId: string,
  input: {
    enrollment_id?: string | null;
    treatment_id: string;
    video_id?: string | null;
    title: string;
    module_label?: string | null;
    timestamp_seconds?: number | null;
  },
) {
  if (input.enrollment_id) {
    const enrollment = await getOwnedEnrollment(userId, input.enrollment_id);
    if (!enrollment) {
      throw Object.assign(new Error("Enrollment not found"), { status: 404 });
    }
  }

  const [rows] = await db.query(
    `INSERT INTO ${BOOKMARKS_TABLE}
       (user_id, enrollment_id, treatment_id, video_id, title, module_label, timestamp_seconds)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, enrollment_id, treatment_id, video_id, title, module_label,
               timestamp_seconds, created_at::text AS created_at`,
    [
      userId,
      input.enrollment_id ?? null,
      input.treatment_id,
      input.video_id ?? null,
      input.title,
      input.module_label ?? null,
      input.timestamp_seconds ?? null,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function deleteStudentBookmark(userId: string, bookmarkId: string) {
  const [rows] = await db.query(
    `UPDATE ${BOOKMARKS_TABLE}
     SET deleted_at = now()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [bookmarkId, userId],
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw Object.assign(new Error("Bookmark not found"), { status: 404 });
  }
  return rows[0];
}
