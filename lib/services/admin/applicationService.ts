import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import {
  BATCHES_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { createEnrollment } from "./enrollmentService";

type ApplicationRecord = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  status: string;
  course_id: string | null;
  course_title?: string | null;
  course_preference?: string | null;
  highest_qualification?: string | null;
  preferred_batch_id?: string | null;
  preferred_campus_id?: string | null;
  quoted_price?: number | null;
  currency?: string;
  eligible_qualifications?: string[];
  qualification_ok: boolean;
};

const QUALIFICATION_ALIASES: Record<string, string[]> = {
  MBBS: ["MBBS", "Bachelor of Medicine"],
  BAMS: ["BAMS"],
  MDS: ["MDS", "Master of Dental Surgery"],
  BHMS: ["BHMS"],
  BDS: ["BDS", "Bachelor of Dental Surgery"],
  "Allied Health Physician": [
    "Allied Health Physician",
    "Allied Health",
    "Allied Physician",
  ],
};

function normalizeQualification(value: string): string {
  return value.trim().toUpperCase();
}

export function qualificationMatches(
  applicantQual: string | null | undefined,
  eligible: string[],
): boolean {
  if (!eligible.length) return true;
  if (!applicantQual?.trim()) return false;
  const norm = normalizeQualification(applicantQual);
  for (const allowed of eligible) {
    const aliases = QUALIFICATION_ALIASES[allowed] ?? [allowed];
    if (
      aliases.some(
        (a) =>
          norm.includes(normalizeQualification(a)) ||
          normalizeQualification(a).includes(norm),
      )
    ) {
      return true;
    }
  }
  return false;
}

export async function listApplications(opts: {
  status?: string;
  course_id?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.status) {
    where.push(`a.status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.course_id) {
    where.push(`a.course_id = $${i++}`);
    params.push(opts.course_id);
  }
  if (opts.search?.trim()) {
    where.push(
      `(a.full_name ILIKE $${i} OR a.email ILIKE $${i} OR a.registration_id ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${ENROLLMENT_APPLICATIONS_TABLE} a ${whereSql}`,
    params,
  );
  const total = parseInt(
    Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
    10,
  );

  const [rows] = await db.query(
    `SELECT a.*, c.title AS course_title, b.name AS batch_name
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${BATCHES_TABLE} b ON b.id = a.preferred_batch_id
     ${whereSql}
     ORDER BY a.created_at DESC
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

export async function getApplicationById(id: string): Promise<ApplicationRecord | null> {
  const [rows] = await db.query(
    `SELECT a.*, c.title AS course_title, c.eligible_qualifications,
            b.name AS batch_name, b.seats_left
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${BATCHES_TABLE} b ON b.id = a.preferred_batch_id
     WHERE a.id = $1`,
    [id],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;

  const app = row as Record<string, unknown>;
  const eligible: string[] = Array.isArray(app.eligible_qualifications)
    ? (app.eligible_qualifications as string[])
    : [];
  const qualification_ok = qualificationMatches(
    app.highest_qualification as string | null | undefined,
    eligible,
  );

  return {
    ...(app as Omit<ApplicationRecord, "qualification_ok" | "eligible_qualifications">),
    eligible_qualifications: eligible,
    qualification_ok,
  };
}

export async function reviewApplication(
  id: string,
  input: { status: "approved" | "rejected" | "under_review"; notes?: string },
) {
  if (input.status === "approved") {
    const app = await getApplicationById(id);
    if (!app) {
      throw Object.assign(new Error("Application not found"), { status: 404 });
    }
    if (!app.qualification_ok && (app.eligible_qualifications?.length ?? 0) > 0) {
      throw Object.assign(
        new Error(
          `Applicant qualification "${app.highest_qualification}" does not match course eligibility`,
        ),
        { status: 422 },
      );
    }
  }

  const [rows] = await db.query(
    `UPDATE ${ENROLLMENT_APPLICATIONS_TABLE}
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING *`,
    [input.status, id],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function convertApplicationToEnrollment(
  applicationId: string,
  opts?: { agreed_price?: number; batch_id?: string },
) {
  const app = await getApplicationById(applicationId);
  if (!app) {
    throw Object.assign(new Error("Application not found"), { status: 404 });
  }
  if (app.status !== "approved") {
    throw Object.assign(
      new Error("Application must be approved before conversion"),
      { status: 422 },
    );
  }
  if (!app.qualification_ok && (app.eligible_qualifications?.length ?? 0) > 0) {
    throw Object.assign(new Error("Applicant does not meet eligibility"), {
      status: 422,
    });
  }

  const batchId = opts?.batch_id ?? app.preferred_batch_id;
  if (batchId) {
    const [batchRows] = await db.query<{ seats_left: number | null }>(
      `SELECT seats_left FROM ${BATCHES_TABLE} WHERE id = $1`,
      [batchId],
    );
    const seatsLeft = Array.isArray(batchRows) ? batchRows[0]?.seats_left : null;
    if (seatsLeft !== null && seatsLeft <= 0) {
      throw Object.assign(new Error("Batch has no seats left"), { status: 409 });
    }
  }

  let userId = app.user_id as string | null;

  if (!userId) {
    const [existing] = await db.query<{ id: string }>(
      `SELECT id FROM ${USERS_TABLE} WHERE email = $1 LIMIT 1`,
      [app.email],
    );
    userId = Array.isArray(existing) ? existing[0]?.id ?? null : null;

    if (!userId) {
      const tempPassword = bcrypt.hashSync(
        `SA-${Date.now().toString(36)}`,
        10,
      );
      const [userRows] = await db.query<{ id: string }>(
        `INSERT INTO ${USERS_TABLE} (email, full_name, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'student', true)
         RETURNING id`,
        [app.email, app.full_name, tempPassword],
      );
      userId = Array.isArray(userRows) ? userRows[0]?.id ?? null : null;
    }
  }

  if (!userId) {
    throw Object.assign(new Error("Failed to create user"), { status: 500 });
  }

  const courseId = app.course_id;
  let treatments: Array<{
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
  }> = [];

  if (courseId) {
    const [ctRows] = await db.query<{
      treatment_id: string;
      sort_order: number;
      hands_on_default: boolean;
    }>(
      `SELECT treatment_id, sort_order, hands_on_default
       FROM ${COURSE_TREATMENTS_TABLE} WHERE course_id = $1 ORDER BY sort_order`,
      [courseId],
    );
    treatments = (Array.isArray(ctRows) ? ctRows : []).map((t) => ({
      treatment_id: t.treatment_id,
      sort_order: t.sort_order,
      hands_on_included: t.hands_on_default,
    }));
  }

  const enrollment = await createEnrollment({
    user_id: userId,
    course_id: courseId,
    title: app.course_title ?? app.course_preference ?? "PGDCC Enrollment",
    origin: "catalog",
    status: "active",
    currency: app.currency ?? "INR",
    agreed_price: opts?.agreed_price ?? app.quoted_price ?? null,
    batch_id: batchId,
    campus_id: app.preferred_campus_id,
    treatments,
  });

  if (batchId) {
    await db.query(
      `UPDATE ${BATCHES_TABLE}
       SET seats_left = GREATEST(COALESCE(seats_left, 0) - 1, 0), updated_at = now()
       WHERE id = $1`,
      [batchId],
    );
  }

  await db.query(
    `UPDATE ${ENROLLMENT_APPLICATIONS_TABLE}
     SET status = 'enrolled', user_id = $1, updated_at = now()
     WHERE id = $2`,
    [userId, applicationId],
  );

  return enrollment;
}
