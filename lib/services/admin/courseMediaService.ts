import { db } from "@/lib/db";
import { COURSE_MEDIA_TABLE, COURSES_TABLE } from "@/lib/db/schema";
import type {
  CreateCourseMediaInput,
  UpdateCourseMediaInput,
} from "@/lib/validations/admin/courseMedia";

export type CourseMediaRow = {
  id: string;
  course_id: string;
  kind: "image" | "video";
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  caption: string | null;
  sort_order: number;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
};

async function assertCourseExists(courseId: string) {
  const [rows] = await db.query<{ id: string }>(
    `SELECT id FROM ${COURSES_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [courseId],
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw Object.assign(new Error("Course not found"), { status: 404 });
  }
}

export async function listCourseMedia(courseId: string) {
  await assertCourseExists(courseId);
  const [rows] = await db.query<CourseMediaRow>(
    `SELECT id, course_id, kind, url, thumbnail_url, title, caption,
            sort_order, mime_type, created_at, updated_at
     FROM ${COURSE_MEDIA_TABLE}
     WHERE course_id = $1 AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [courseId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createCourseMedia(
  courseId: string,
  input: CreateCourseMediaInput,
) {
  await assertCourseExists(courseId);

  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const [maxRows] = await db.query<{ max: number | null }>(
      `SELECT MAX(sort_order) AS max FROM ${COURSE_MEDIA_TABLE}
       WHERE course_id = $1 AND deleted_at IS NULL`,
      [courseId],
    );
    const max = Array.isArray(maxRows) ? maxRows[0]?.max : null;
    sortOrder = (max ?? -1) + 1;
  }

  const [rows] = await db.query<CourseMediaRow>(
    `INSERT INTO ${COURSE_MEDIA_TABLE} (
       course_id, kind, url, thumbnail_url, title, caption, sort_order, mime_type
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, course_id, kind, url, thumbnail_url, title, caption,
               sort_order, mime_type, created_at, updated_at`,
    [
      courseId,
      input.kind,
      input.url,
      input.thumbnail_url ?? null,
      input.title?.trim() || null,
      input.caption?.trim() || null,
      sortOrder,
      input.mime_type ?? null,
    ],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function updateCourseMedia(
  courseId: string,
  mediaId: string,
  patch: UpdateCourseMediaInput,
) {
  await assertCourseExists(courseId);

  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  for (const key of [
    "url",
    "thumbnail_url",
    "title",
    "caption",
    "sort_order",
    "mime_type",
  ] as const) {
    if (patch[key] === undefined) continue;
    let value: unknown = patch[key];
    if (key === "title" || key === "caption") {
      value =
        typeof value === "string" && value.trim() ? value.trim() : null;
    }
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }

  if (!fields.length) {
    const [existing] = await db.query<CourseMediaRow>(
      `SELECT id, course_id, kind, url, thumbnail_url, title, caption,
              sort_order, mime_type, created_at, updated_at
       FROM ${COURSE_MEDIA_TABLE}
       WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL`,
      [mediaId, courseId],
    );
    return Array.isArray(existing) ? existing[0] ?? null : null;
  }

  fields.push("updated_at = now()");
  params.push(mediaId, courseId);

  const [rows] = await db.query<CourseMediaRow>(
    `UPDATE ${COURSE_MEDIA_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i++} AND course_id = $${i++} AND deleted_at IS NULL
     RETURNING id, course_id, kind, url, thumbnail_url, title, caption,
               sort_order, mime_type, created_at, updated_at`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function softDeleteCourseMedia(courseId: string, mediaId: string) {
  await assertCourseExists(courseId);
  const [rows] = await db.query<{ id: string }>(
    `UPDATE ${COURSE_MEDIA_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND course_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [mediaId, courseId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function reorderCourseMedia(
  courseId: string,
  orderedIds: string[],
) {
  await assertCourseExists(courseId);
  for (let index = 0; index < orderedIds.length; index++) {
    await db.query(
      `UPDATE ${COURSE_MEDIA_TABLE}
       SET sort_order = $1, updated_at = now()
       WHERE id = $2 AND course_id = $3 AND deleted_at IS NULL`,
      [index, orderedIds[index], courseId],
    );
  }
  return listCourseMedia(courseId);
}
