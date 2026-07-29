import { db, withTransaction } from "@/lib/db";
import {
  BATCHES_TABLE,
  CAMPUSES_TABLE,
  COURSE_CATEGORIES_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
} from "@/lib/db/schema";

export async function listCategories() {
  const [rows] = await db.query(
    `SELECT * FROM ${COURSE_CATEGORIES_TABLE} ORDER BY sort_order, title`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createCategory(input: {
  slug: string;
  title: string;
  icon?: string | null;
  sort_order: number;
}) {
  try {
    const [rows] = await db.query(
      `INSERT INTO ${COURSE_CATEGORIES_TABLE} (slug, title, icon, sort_order)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [input.slug, input.title, input.icon ?? null, input.sort_order],
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Category slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function updateCategory(
  id: string,
  patch: Record<string, unknown>,
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }
  if (!fields.length) return null;
  fields.push("updated_at = now()");
  params.push(id);
  try {
    const [rows] = await db.query(
      `UPDATE ${COURSE_CATEGORIES_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i}
       RETURNING *`,
      params,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Category slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function deleteCategory(id: string) {
  const [rows] = await db.query(
    `DELETE FROM ${COURSE_CATEGORIES_TABLE} WHERE id = $1 RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function listCourses(opts: {
  status?: string;
  category_id?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.status) {
    where.push(`c.status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.category_id) {
    where.push(`c.category_id = $${i++}`);
    params.push(opts.category_id);
  }
  if (opts.search?.trim()) {
    where.push(`(c.title ILIKE $${i} OR c.slug ILIKE $${i})`);
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${COURSES_TABLE} c ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT c.*, cat.title AS category_title
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${COURSE_CATEGORIES_TABLE} cat ON cat.id = c.category_id
     ${whereSql}
     ORDER BY c.created_at DESC
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

export async function getCourseById(id: string) {
  const [rows] = await db.query(
    `SELECT c.*, cat.title AS category_title
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${COURSE_CATEGORIES_TABLE} cat ON cat.id = c.category_id
     WHERE c.id = $1 AND c.deleted_at IS NULL`,
    [id],
  );
  const course = Array.isArray(rows) ? rows[0] : null;
  if (!course) return null;

  const [treatments] = await db.query(
    `SELECT ct.*, t.name AS treatment_name, t.slug AS treatment_slug
     FROM ${COURSE_TREATMENTS_TABLE} ct
     JOIN treatments t ON t.id = ct.treatment_id
     WHERE ct.course_id = $1
     ORDER BY ct.sort_order`,
    [id],
  );

  return {
    ...course,
    treatments: Array.isArray(treatments) ? treatments : [],
  };
}

export async function createCourse(input: Record<string, unknown>) {
  try {
    const [rows] = await db.query(
      `INSERT INTO ${COURSES_TABLE}
         (slug, title, description, image_url, duration_label, mode, level,
          category_id, list_price, currency, rating, certificate_label,
          faculty_lead_id, tag, is_bestseller, is_customizable, status,
          seo_title, seo_description, color_token, published_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        input.slug,
        input.title,
        input.description ?? null,
        input.image_url ?? null,
        input.duration_label ?? null,
        input.mode ?? null,
        input.level ?? null,
        input.category_id ?? null,
        input.list_price ?? null,
        input.currency ?? "INR",
        input.rating ?? null,
        input.certificate_label ?? null,
        input.faculty_lead_id ?? null,
        input.tag ?? null,
        input.is_bestseller ?? false,
        input.is_customizable ?? true,
        input.status ?? "draft",
        input.seo_title ?? null,
        input.seo_description ?? null,
        input.color_token ?? null,
        input.published_at ?? null,
      ],
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Course slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function updateCourse(id: string, patch: Record<string, unknown>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "programme_meta") {
      fields.push(`${key} = $${i++}::jsonb`);
      params.push(JSON.stringify(value ?? {}));
      continue;
    }
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }
  if (!fields.length) return getCourseById(id);
  fields.push("updated_at = now()");
  params.push(id);
  try {
    const [rows] = await db.query(
      `UPDATE ${COURSES_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Course slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function softDeleteCourse(id: string) {
  const [rows] = await db.query(
    `UPDATE ${COURSES_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function setCourseTreatments(
  courseId: string,
  treatments: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_default: boolean;
    delivery_modes?: Array<"hands_on" | "practical" | "lecture">;
    live_sessions_planned?: number;
  }>,
) {
  return withTransaction(async (conn) => {
    await conn.query(
      `DELETE FROM ${COURSE_TREATMENTS_TABLE} WHERE course_id = $1`,
      [courseId],
    );

    for (const t of treatments) {
      const modes: Array<"hands_on" | "practical" | "lecture"> =
        t.delivery_modes && t.delivery_modes.length > 0
          ? t.delivery_modes
          : t.hands_on_default
            ? ["hands_on"]
            : ["lecture"];
      const handsOn =
        modes.includes("hands_on") || modes.includes("practical");
      const livePlanned = Math.max(0, t.live_sessions_planned ?? 1);

      await conn.query(
        `INSERT INTO ${COURSE_TREATMENTS_TABLE}
           (course_id, treatment_id, sort_order, hands_on_default, delivery_modes, live_sessions_planned)
         VALUES ($1,$2,$3,$4,$5::text[],$6)`,
        [courseId, t.treatment_id, t.sort_order, handsOn, modes, livePlanned],
      );
    }

    const [rows] = await conn.query(
      `SELECT ct.*, t.name AS treatment_name, t.slug AS treatment_slug
       FROM ${COURSE_TREATMENTS_TABLE} ct
       JOIN treatments t ON t.id = ct.treatment_id
       WHERE ct.course_id = $1
       ORDER BY ct.sort_order`,
      [courseId],
    );
    return Array.isArray(rows) ? rows : [];
  });
}

export async function listCampuses() {
  const [rows] = await db.query(
    `SELECT * FROM ${CAMPUSES_TABLE} ORDER BY name`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createCampus(input: {
  name: string;
  city?: string | null;
  address?: string | null;
  is_active: boolean;
}) {
  const [rows] = await db.query(
    `INSERT INTO ${CAMPUSES_TABLE} (name, city, address, is_active)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.name, input.city ?? null, input.address ?? null, input.is_active],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function listBatches(courseId?: string) {
  if (courseId) {
    const [rows] = await db.query(
      `SELECT * FROM ${BATCHES_TABLE} WHERE course_id = $1 ORDER BY starts_on NULLS LAST, name`,
      [courseId],
    );
    return Array.isArray(rows) ? rows : [];
  }
  const [rows] = await db.query(
    `SELECT * FROM ${BATCHES_TABLE} ORDER BY starts_on NULLS LAST, name`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createBatch(input: Record<string, unknown>) {
  const [rows] = await db.query(
    `INSERT INTO ${BATCHES_TABLE}
       (course_id, campus_id, name, starts_on, ends_on, training_mode,
        seats_total, seats_left, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      input.course_id ?? null,
      input.campus_id ?? null,
      input.name,
      input.starts_on ?? null,
      input.ends_on ?? null,
      input.training_mode ?? null,
      input.seats_total ?? null,
      input.seats_left ?? null,
      input.is_active ?? true,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}
