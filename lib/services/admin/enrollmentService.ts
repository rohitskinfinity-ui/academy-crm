import { db, withTransaction, type DbConnection } from "@/lib/db";
import {
  COURSE_TREATMENTS_TABLE,
  ENROLLMENT_TREATMENT_STAGES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";

const STAGE_ORDER = ["theory", "observation", "training", "hands-on"] as const;

async function seedStages(
  conn: DbConnection,
  enrollmentTreatmentId: string,
  handsOnIncluded: boolean,
) {
  const stages = handsOnIncluded
    ? STAGE_ORDER
    : (["theory", "observation", "training"] as const);

  for (let i = 0; i < stages.length; i++) {
    const status = i === 0 ? "available" : "locked";
    await conn.query(
      `INSERT INTO ${ENROLLMENT_TREATMENT_STAGES_TABLE}
         (enrollment_treatment_id, stage, status, started_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (enrollment_treatment_id, stage) DO NOTHING`,
      [
        enrollmentTreatmentId,
        stages[i],
        status,
        i === 0 ? new Date().toISOString() : null,
      ],
    );
  }
}

async function insertEnrollmentTreatments(
  conn: DbConnection,
  enrollmentId: string,
  treatments: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
  }>,
) {
  for (const t of treatments) {
    const [rows] = await conn.query<{ id: string }>(
      `INSERT INTO ${ENROLLMENT_TREATMENTS_TABLE}
         (enrollment_id, treatment_id, sort_order, hands_on_included)
       VALUES ($1,$2,$3,$4)
       RETURNING id`,
      [enrollmentId, t.treatment_id, t.sort_order, t.hands_on_included],
    );
    const etId = Array.isArray(rows) ? rows[0]?.id : undefined;
    if (etId) {
      await seedStages(conn, etId, t.hands_on_included);
    }
  }
}

export async function listEnrollments(opts: {
  user_id?: string;
  course_id?: string;
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = ["e.deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.user_id) {
    where.push(`e.user_id = $${i++}`);
    params.push(opts.user_id);
  }
  if (opts.course_id) {
    where.push(`e.course_id = $${i++}`);
    params.push(opts.course_id);
  }
  if (opts.status) {
    where.push(`e.status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.search?.trim()) {
    where.push(
      `(e.title ILIKE $${i} OR u.full_name ILIKE $${i} OR u.email ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id
     ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT e.*,
            u.full_name AS user_full_name,
            u.email AS user_email,
            c.title AS course_title
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id
     LEFT JOIN courses c ON c.id = e.course_id
     ${whereSql}
     ORDER BY e.created_at DESC
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

export async function getEnrollmentById(id: string) {
  const [rows] = await db.query(
    `SELECT e.*,
            u.full_name AS user_full_name,
            u.email AS user_email,
            c.title AS course_title
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id
     LEFT JOIN courses c ON c.id = e.course_id
     WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [id],
  );
  const enrollment = Array.isArray(rows) ? rows[0] : null;
  if (!enrollment) return null;

  const [treatments] = await db.query(
    `SELECT et.*, t.name AS treatment_name, t.slug AS treatment_slug
     FROM ${ENROLLMENT_TREATMENTS_TABLE} et
     JOIN treatments t ON t.id = et.treatment_id
     WHERE et.enrollment_id = $1
     ORDER BY et.sort_order`,
    [id],
  );

  const items = Array.isArray(treatments) ? treatments : [];
  for (const item of items) {
    const et = item as { id: string; stages?: unknown };
    const [stages] = await db.query(
      `SELECT * FROM ${ENROLLMENT_TREATMENT_STAGES_TABLE}
       WHERE enrollment_treatment_id = $1
       ORDER BY CASE stage
         WHEN 'theory' THEN 1
         WHEN 'observation' THEN 2
         WHEN 'training' THEN 3
         WHEN 'hands-on' THEN 4
       END`,
      [et.id],
    );
    et.stages = Array.isArray(stages) ? stages : [];
  }

  return { ...enrollment, treatments: items };
}

export async function createEnrollment(input: {
  user_id: string;
  course_id?: string | null;
  title: string;
  origin: string;
  status: string;
  agreed_price?: number | null;
  currency: string;
  color_token?: string | null;
  batch_id?: string | null;
  campus_id?: string | null;
  notes_internal?: string | null;
  treatments?: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
  }>;
}) {
  return withTransaction(async (conn) => {
    const [created] = await conn.query<{ id: string }>(
      `INSERT INTO ${ENROLLMENTS_TABLE}
         (user_id, course_id, title, origin, status, agreed_price, currency,
          color_token, batch_id, campus_id, notes_internal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        input.user_id,
        input.course_id ?? null,
        input.title,
        input.origin,
        input.status,
        input.agreed_price ?? null,
        input.currency,
        input.color_token ?? null,
        input.batch_id ?? null,
        input.campus_id ?? null,
        input.notes_internal ?? null,
      ],
    );

    const enrollmentId = Array.isArray(created) ? created[0]?.id : undefined;
    if (!enrollmentId) throw new Error("Failed to create enrollment");

    let treatments = input.treatments;
    if ((!treatments || treatments.length === 0) && input.course_id) {
      const [ctRows] = await conn.query<{
        treatment_id: string;
        sort_order: number;
        hands_on_default: boolean;
      }>(
        `SELECT treatment_id, sort_order, hands_on_default
         FROM ${COURSE_TREATMENTS_TABLE}
         WHERE course_id = $1
         ORDER BY sort_order`,
        [input.course_id],
      );
      treatments = Array.isArray(ctRows)
        ? ctRows.map((r) => ({
            treatment_id: r.treatment_id,
            sort_order: r.sort_order,
            hands_on_included: r.hands_on_default,
          }))
        : [];
    }

    if (treatments?.length) {
      await insertEnrollmentTreatments(conn, enrollmentId, treatments);
    }

    return enrollmentId;
  }).then((id) => getEnrollmentById(id));
}

export async function patchEnrollment(
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
  if (!fields.length) return getEnrollmentById(id);
  fields.push("updated_at = now()");
  params.push(id);

  const [rows] = await db.query(
    `UPDATE ${ENROLLMENTS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING id`,
    params,
  );
  if (!Array.isArray(rows) || !rows[0]) return null;
  return getEnrollmentById(id);
}

export async function softDeleteEnrollment(id: string) {
  const [rows] = await db.query(
    `UPDATE ${ENROLLMENTS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function setEnrollmentTreatments(
  enrollmentId: string,
  treatments: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
  }>,
  agreedPrice?: number | null,
) {
  await withTransaction(async (conn) => {
    await conn.query(
      `DELETE FROM ${ENROLLMENT_TREATMENTS_TABLE} WHERE enrollment_id = $1`,
      [enrollmentId],
    );
    await insertEnrollmentTreatments(conn, enrollmentId, treatments);

    if (agreedPrice !== undefined) {
      await conn.query(
        `UPDATE ${ENROLLMENTS_TABLE}
         SET agreed_price = $1, updated_at = now()
         WHERE id = $2`,
        [agreedPrice, enrollmentId],
      );
    }
  });

  return getEnrollmentById(enrollmentId);
}

export async function patchEnrollmentTreatment(
  enrollmentTreatmentId: string,
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
  params.push(enrollmentTreatmentId);

  const [rows] = await db.query(
    `UPDATE ${ENROLLMENT_TREATMENTS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );

  const updated = Array.isArray(rows) ? rows[0] : null;
  if (
    updated &&
    typeof patch.hands_on_included === "boolean"
  ) {
    // Re-seed stages if hands-on toggled
    await withTransaction(async (conn) => {
      await conn.query(
        `DELETE FROM ${ENROLLMENT_TREATMENT_STAGES_TABLE}
         WHERE enrollment_treatment_id = $1`,
        [enrollmentTreatmentId],
      );
      await seedStages(
        conn,
        enrollmentTreatmentId,
        patch.hands_on_included as boolean,
      );
    });
  }

  return updated;
}
