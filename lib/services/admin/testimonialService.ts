import { db } from "@/lib/db";
import { TESTIMONIALS_TABLE } from "@/lib/db/schema";

const SELECT_COLS = `
  id, type, person_name, credentials, role, company, location,
  course_id, course_label, rating, quote, image_url, thumbnail_url,
  video_url, video_duration, video_title, is_featured, sort_order,
  status, published_at::text, review_date::text,
  created_at::text, updated_at::text
`;

export async function listTestimonials(opts: {
  type?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.type) {
    where.push(`type = $${i++}`);
    params.push(opts.type);
  }
  if (opts.status) {
    where.push(`status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.search?.trim()) {
    where.push(
      `(person_name ILIKE $${i} OR COALESCE(credentials, '') ILIKE $${i} OR COALESCE(course_label, '') ILIKE $${i} OR quote ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TESTIMONIALS_TABLE} ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${TESTIMONIALS_TABLE}
     ${whereSql}
     ORDER BY sort_order ASC, created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  return {
    items: Array.isArray(rows) ? rows : [],
    pagination: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}

export async function getTestimonialById(id: string) {
  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${TESTIMONIALS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function createTestimonial(input: Record<string, unknown>) {
  const status = (input.status as string) || "draft";
  const publishedAt =
    input.published_at ??
    (status === "published" ? new Date().toISOString() : null);

  const [rows] = await db.query(
    `INSERT INTO ${TESTIMONIALS_TABLE}
       (type, person_name, credentials, role, company, location,
        course_id, course_label, rating, quote, image_url, thumbnail_url,
        video_url, video_duration, video_title, is_featured, sort_order,
        status, published_at, review_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING ${SELECT_COLS}`,
    [
      input.type ?? "text",
      input.person_name,
      input.credentials ?? null,
      input.role ?? null,
      input.company ?? null,
      input.location ?? null,
      input.course_id ?? null,
      input.course_label ?? null,
      input.rating ?? null,
      input.quote,
      input.image_url ?? null,
      input.thumbnail_url ?? null,
      input.video_url ?? null,
      input.video_duration ?? null,
      input.video_title ?? null,
      input.is_featured ?? false,
      input.sort_order ?? 0,
      status,
      publishedAt,
      input.review_date ?? null,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateTestimonial(
  id: string,
  input: Record<string, unknown>,
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const map: Array<[string, unknown]> = [
    ["type", input.type],
    ["person_name", input.person_name],
    ["credentials", input.credentials],
    ["role", input.role],
    ["company", input.company],
    ["location", input.location],
    ["course_id", input.course_id],
    ["course_label", input.course_label],
    ["rating", input.rating],
    ["quote", input.quote],
    ["image_url", input.image_url],
    ["thumbnail_url", input.thumbnail_url],
    ["video_url", input.video_url],
    ["video_duration", input.video_duration],
    ["video_title", input.video_title],
    ["is_featured", input.is_featured],
    ["sort_order", input.sort_order],
    ["status", input.status],
    ["published_at", input.published_at],
    ["review_date", input.review_date],
  ];

  for (const [col, value] of map) {
    if (value !== undefined) {
      fields.push(`${col} = $${i++}`);
      params.push(value);
    }
  }

  if (!fields.length) return getTestimonialById(id);

  // Auto-set published_at when publishing
  if (input.status === "published" && input.published_at === undefined) {
    fields.push(`published_at = COALESCE(published_at, now())`);
  }

  fields.push(`updated_at = now()`);
  params.push(id);

  const [rows] = await db.query(
    `UPDATE ${TESTIMONIALS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING ${SELECT_COLS}`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function deleteTestimonial(id: string) {
  const [rows] = await db.query(
    `UPDATE ${TESTIMONIALS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
