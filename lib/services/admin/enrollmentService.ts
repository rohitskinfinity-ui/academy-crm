import { db, withTransaction, type DbConnection } from "@/lib/db";
import {
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  ENROLLMENT_TREATMENT_STAGES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  PAYMENTS_TABLE,
  USERS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import { getApplicationForEnrollment } from "./applicationLookup";
import {
  DEFAULT_REFERRAL_REWARD,
  getEnrollmentReferralCredit,
  getReferralWallet,
  inspectReferralCode,
  lookupReferralCode,
  markReferralEnrolled,
  normalizeReferralCode,
  redeemReferralCredit,
} from "@/lib/services/referrals";

function money(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function remainingBalance(
  agreedPrice: unknown,
  amountPaid: number,
): number | null {
  if (agreedPrice == null || agreedPrice === "") return null;
  const agreed = money(agreedPrice);
  return Math.max(0, Math.round((agreed - amountPaid) * 100) / 100);
}

async function resolveEnrollmentReferralCode(
  raw: string | null | undefined,
): Promise<string | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const inspected = await inspectReferralCode(code);
  if (!inspected.valid) {
    throw Object.assign(new Error(inspected.message), { status: 400 });
  }
  return inspected.row.code;
}

async function attributeEnrollmentReferral(input: {
  userId: string;
  referralCode: string | null;
}) {
  if (!input.referralCode) return;
  const [userRows] = await db.query<{ full_name: string; email: string }>(
    `SELECT full_name, email FROM ${USERS_TABLE} WHERE id = $1`,
    [input.userId],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  if (!user?.email) return;
  await markReferralEnrolled({
    inviteeUserId: input.userId,
    inviteeEmail: user.email,
    inviteeName: user.full_name,
    referralCode: input.referralCode,
  });
}

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
  type?: "course" | "workshop";
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
  if (opts.type === "workshop") {
    where.push(`e.workshop_id IS NOT NULL`);
  } else if (opts.type === "course") {
    where.push(`e.workshop_id IS NULL`);
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
            c.title AS course_title,
            w.title AS workshop_title,
            CASE
              WHEN e.workshop_id IS NOT NULL THEN 'workshop'
              ELSE 'course'
            END AS type,
            COALESCE(pay.amount_paid, 0)::float8 AS amount_paid,
            CASE
              WHEN e.agreed_price IS NULL THEN NULL
              ELSE GREATEST(e.agreed_price - COALESCE(pay.amount_paid, 0), 0)
            END::float8 AS remaining_amount
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = e.workshop_id
     LEFT JOIN (
       SELECT enrollment_id, SUM(amount) AS amount_paid
       FROM ${PAYMENTS_TABLE}
       WHERE status = 'paid' AND enrollment_id IS NOT NULL
       GROUP BY enrollment_id
     ) pay ON pay.enrollment_id = e.id
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

/**
 * Unified board: pending enrollment applications (leads) + confirmed enrollments.
 */
export async function listEnrollmentBoard(opts: {
  search?: string;
  type?: "course" | "workshop";
  /** pending = leads only; active = confirmed enrollments; all = both */
  board_status?: "pending" | "active" | "all";
  page: number;
  limit: number;
}) {
  const boardStatus = opts.board_status ?? "all";
  const typeFilter = opts.type;
  const search = opts.search?.trim() || null;
  const offset = (opts.page - 1) * opts.limit;

  const leadSelect = `
    SELECT
      a.id,
      'lead'::text AS record_kind,
      CASE
        WHEN a.application_kind = 'workshop' OR a.workshop_id IS NOT NULL
          THEN 'workshop'
        ELSE 'course'
      END AS type,
      a.status::text AS status,
      COALESCE(w.title, c.title, a.course_preference, a.full_name) AS title,
      a.full_name AS user_full_name,
      a.email AS user_email,
      a.whatsapp AS phone,
      c.title AS course_title,
      w.title AS workshop_title,
      a.quoted_price AS agreed_price,
      a.currency,
      NULL::text AS payment_type,
      a.created_at AS started_at,
      a.created_at,
      a.registration_id,
      a.application_kind,
      a.course_id,
      a.workshop_id,
      NULL::uuid AS user_id
    FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
    LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
    LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
    WHERE a.status IN ('submitted', 'under_review', 'approved')
  `;

  const enrollmentSelect = `
    SELECT
      e.id,
      'enrollment'::text AS record_kind,
      CASE
        WHEN e.workshop_id IS NOT NULL THEN 'workshop'
        ELSE 'course'
      END AS type,
      e.status::text AS status,
      e.title,
      u.full_name AS user_full_name,
      u.email AS user_email,
      NULL::text AS phone,
      c.title AS course_title,
      w.title AS workshop_title,
      e.agreed_price,
      e.currency,
      e.payment_type,
      e.started_at,
      e.created_at,
      NULL::text AS registration_id,
      NULL::text AS application_kind,
      e.course_id,
      e.workshop_id,
      e.user_id
    FROM ${ENROLLMENTS_TABLE} e
    JOIN ${USERS_TABLE} u ON u.id = e.user_id
    LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
    LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = e.workshop_id
    WHERE e.deleted_at IS NULL
  `;

  let unionSql: string;
  if (boardStatus === "pending") {
    unionSql = leadSelect;
  } else if (boardStatus === "active") {
    unionSql = enrollmentSelect;
  } else {
    unionSql = `${leadSelect} UNION ALL ${enrollmentSelect}`;
  }

  const outerWhere: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (typeFilter) {
    outerWhere.push(`type = $${i++}`);
    params.push(typeFilter);
  }
  if (search) {
    outerWhere.push(
      `(title ILIKE $${i} OR user_full_name ILIKE $${i} OR COALESCE(user_email, '') ILIKE $${i} OR COALESCE(registration_id, '') ILIKE $${i})`,
    );
    params.push(`%${search}%`);
    i++;
  }

  const whereSql = outerWhere.length
    ? `WHERE ${outerWhere.join(" AND ")}`
    : "";

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM (${unionSql}) board ${whereSql}`,
    params,
  );
  const total = parseInt(
    Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
    10,
  );

  const [rows] = await db.query(
    `SELECT * FROM (${unionSql}) board
     ${whereSql}
     ORDER BY created_at DESC
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
            c.title AS course_title,
            w.title AS workshop_title,
            CASE
              WHEN e.workshop_id IS NOT NULL THEN 'workshop'
              ELSE 'course'
            END AS type
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${USERS_TABLE} u ON u.id = e.user_id
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = e.workshop_id
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

  const application = await getApplicationForEnrollment(
    id,
    (enrollment as { user_id?: string }).user_id,
  );

  const [paymentRows] = await db.query<{
    id: string;
    txn_code: string;
    amount: string | number;
    currency: string;
    method: string | null;
    status: string;
    payment_option: string | null;
    description: string | null;
    paid_at: string | null;
    created_at: string;
  }>(
    `SELECT id, txn_code, amount, currency, method::text AS method,
            status::text AS status, payment_option::text AS payment_option,
            description, paid_at::text AS paid_at, created_at::text AS created_at
     FROM ${PAYMENTS_TABLE}
     WHERE enrollment_id = $1
     ORDER BY COALESCE(paid_at, created_at) DESC`,
    [id],
  );
  const payments = (Array.isArray(paymentRows) ? paymentRows : []).map((p) => ({
    ...p,
    amount: money(p.amount),
  }));
  const amountPaid = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
  const agreedPrice = (enrollment as { agreed_price?: unknown }).agreed_price;
  const referralCode = normalizeReferralCode(
    (enrollment as { referral_code?: string | null }).referral_code,
  );
  const referralRow = referralCode
    ? await lookupReferralCode(referralCode)
    : null;
  const referrerFirstName = referralRow?.referrer_name
    ? referralRow.referrer_name.trim().split(/\s+/)[0]
    : null;

  const userId = (enrollment as { user_id?: string }).user_id;
  const referralCreditApplied = await getEnrollmentReferralCredit(id);
  const studentWallet = userId ? await getReferralWallet(userId) : null;

  return {
    ...enrollment,
    referral_code: referralCode,
    referrer_first_name: referrerFirstName,
    friend_discount: referralRow
      ? Number(referralRow.reward_amount) || DEFAULT_REFERRAL_REWARD
      : null,
    referral_currency: referralRow?.currency ?? null,
    referral_credit_applied: referralCreditApplied,
    student_wallet: studentWallet,
    treatments: items,
    application,
    payments,
    amount_paid: Math.round(amountPaid * 100) / 100,
    remaining_amount: remainingBalance(agreedPrice, amountPaid),
  };
}

export async function createEnrollment(input: {
  user_id: string;
  course_id?: string | null;
  workshop_id?: string | null;
  title: string;
  origin: string;
  status: string;
  agreed_price?: number | null;
  currency: string;
  color_token?: string | null;
  batch_id?: string | null;
  campus_id?: string | null;
  notes_internal?: string | null;
  payment_type?: "advance" | "full" | null;
  referral_code?: string | null;
  apply_referral_credit?: boolean;
  treatments?: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
  }>;
}) {
  const referralCode = await resolveEnrollmentReferralCode(input.referral_code);
  return withTransaction(async (conn) => {
    const [created] = await conn.query<{ id: string }>(
      `INSERT INTO ${ENROLLMENTS_TABLE}
         (user_id, course_id, workshop_id, title, origin, status, agreed_price, currency,
          color_token, batch_id, campus_id, notes_internal, payment_type, referral_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        input.user_id,
        input.course_id ?? null,
        input.workshop_id ?? null,
        input.title,
        input.origin,
        input.status,
        input.agreed_price ?? null,
        input.currency,
        input.color_token ?? null,
        input.batch_id ?? null,
        input.campus_id ?? null,
        input.notes_internal ?? null,
        input.payment_type ?? null,
        referralCode,
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
  }).then(async (id) => {
    await attributeEnrollmentReferral({
      userId: input.user_id,
      referralCode,
    });
    if (input.apply_referral_credit) {
      const agreed = money(input.agreed_price);
      await redeemReferralCredit({
        userId: input.user_id,
        enrollmentId: id,
        courseId: input.course_id ?? null,
        maxAmount: input.agreed_price == null ? null : agreed,
        currency: input.currency,
      });
    }
    return getEnrollmentById(id);
  });
}

export async function patchEnrollment(
  id: string,
  patch: Record<string, unknown>,
) {
  const next = { ...patch };
  if ("referral_code" in next) {
    next.referral_code = await resolveEnrollmentReferralCode(
      next.referral_code as string | null | undefined,
    );
  }

  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(next)) {
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

  if ("referral_code" in next) {
    const updated = await getEnrollmentById(id);
    const userId = (updated as { user_id?: string } | null)?.user_id;
    if (userId) {
      await attributeEnrollmentReferral({
        userId,
        referralCode: (next.referral_code as string | null) ?? null,
      });
      return getEnrollmentById(id);
    }
    return updated;
  }

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
