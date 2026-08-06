import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import {
  BATCHES_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import { createEnrollment } from "./enrollmentService";

type ApplicationRecord = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  status: string;
  course_id: string | null;
  workshop_id?: string | null;
  application_kind?: string | null;
  course_title?: string | null;
  workshop_title?: string | null;
  course_preference?: string | null;
  highest_qualification?: string | null;
  preferred_batch_id?: string | null;
  preferred_campus_id?: string | null;
  quoted_price?: number | null;
  currency?: string;
  whatsapp?: string | null;
  alternate_no?: string | null;
  address?: string | null;
  city_state?: string | null;
  pin_code?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  profession?: string | null;
  medical_background?: string | null;
  registration_no?: string | null;
  currently_working?: string | null;
  guardian_name?: string | null;
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
    `SELECT a.*, c.title AS course_title, w.title AS workshop_title,
            b.name AS batch_name
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
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

export async function getApplicationById(
  id: string,
): Promise<ApplicationRecord | null> {
  const [rows] = await db.query(
    `SELECT a.*, c.title AS course_title, c.eligible_qualifications,
            w.title AS workshop_title, b.name AS batch_name, b.seats_left
     FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
     LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
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
    ...(app as Omit<
      ApplicationRecord,
      "qualification_ok" | "eligible_qualifications"
    >),
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
    if (
      !app.qualification_ok &&
      (app.eligible_qualifications?.length ?? 0) > 0
    ) {
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

export async function rejectApplication(id: string) {
  const app = await getApplicationById(id);
  if (!app) {
    throw Object.assign(new Error("Application not found"), { status: 404 });
  }
  if (app.status === "enrolled") {
    throw Object.assign(new Error("Already converted to enrollment"), {
      status: 422,
    });
  }
  return reviewApplication(id, { status: "rejected" });
}

async function ensureStudentFromApplication(
  app: ApplicationRecord,
): Promise<string> {
  let userId = app.user_id as string | null;
  const email = app.email.toLowerCase().trim();

  if (!userId) {
    const [existing] = await db.query<{ id: string }>(
      `SELECT id FROM ${USERS_TABLE}
       WHERE lower(email) = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [email],
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
        [email, app.full_name, tempPassword],
      );
      userId = Array.isArray(userRows) ? userRows[0]?.id ?? null : null;
    } else {
      await db.query(
        `UPDATE ${USERS_TABLE}
         SET full_name = COALESCE(NULLIF($1, ''), full_name),
             role = 'student',
             is_active = true,
             updated_at = now()
         WHERE id = $2`,
        [app.full_name, userId],
      );
    }
  }

  if (!userId) {
    throw Object.assign(new Error("Failed to create user"), { status: 500 });
  }

  await db.query(
    `INSERT INTO ${STUDENT_PROFILES_TABLE}
       (user_id, phone, whatsapp, alternate_phone, address_line, city_state,
        pin_code, date_of_birth, gender, program_label, highest_qualification,
        profession, medical_background, registration_no, currently_working,
        guardian_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     ON CONFLICT (user_id) DO UPDATE SET
       phone = COALESCE(EXCLUDED.phone, ${STUDENT_PROFILES_TABLE}.phone),
       whatsapp = COALESCE(EXCLUDED.whatsapp, ${STUDENT_PROFILES_TABLE}.whatsapp),
       alternate_phone = COALESCE(EXCLUDED.alternate_phone, ${STUDENT_PROFILES_TABLE}.alternate_phone),
       address_line = COALESCE(EXCLUDED.address_line, ${STUDENT_PROFILES_TABLE}.address_line),
       city_state = COALESCE(EXCLUDED.city_state, ${STUDENT_PROFILES_TABLE}.city_state),
       pin_code = COALESCE(EXCLUDED.pin_code, ${STUDENT_PROFILES_TABLE}.pin_code),
       date_of_birth = COALESCE(EXCLUDED.date_of_birth, ${STUDENT_PROFILES_TABLE}.date_of_birth),
       gender = COALESCE(EXCLUDED.gender, ${STUDENT_PROFILES_TABLE}.gender),
       program_label = COALESCE(EXCLUDED.program_label, ${STUDENT_PROFILES_TABLE}.program_label),
       highest_qualification = COALESCE(EXCLUDED.highest_qualification, ${STUDENT_PROFILES_TABLE}.highest_qualification),
       profession = COALESCE(EXCLUDED.profession, ${STUDENT_PROFILES_TABLE}.profession),
       medical_background = COALESCE(EXCLUDED.medical_background, ${STUDENT_PROFILES_TABLE}.medical_background),
       registration_no = COALESCE(EXCLUDED.registration_no, ${STUDENT_PROFILES_TABLE}.registration_no),
       currently_working = COALESCE(EXCLUDED.currently_working, ${STUDENT_PROFILES_TABLE}.currently_working),
       guardian_name = COALESCE(EXCLUDED.guardian_name, ${STUDENT_PROFILES_TABLE}.guardian_name),
       updated_at = now()`,
    [
      userId,
      app.whatsapp ?? null,
      app.whatsapp ?? null,
      app.alternate_no ?? null,
      app.address ?? null,
      app.city_state ?? null,
      app.pin_code ?? null,
      app.date_of_birth || null,
      app.gender ?? null,
      app.course_preference ?? app.course_title ?? app.workshop_title ?? null,
      app.highest_qualification ?? null,
      app.profession ?? null,
      app.medical_background ?? null,
      app.registration_no ?? null,
      app.currently_working ?? null,
      app.guardian_name ?? null,
    ],
  );

  return userId;
}

/**
 * Staff confirm after QR payment: create student + enrollment from lead.
 * Accepts submitted / under_review / approved.
 */
export async function convertApplicationToEnrollment(
  applicationId: string,
  opts?: { agreed_price?: number; batch_id?: string },
) {
  const app = await getApplicationById(applicationId);
  if (!app) {
    throw Object.assign(new Error("Application not found"), { status: 404 });
  }
  if (app.status === "enrolled") {
    throw Object.assign(new Error("Application already enrolled"), {
      status: 422,
    });
  }
  if (app.status === "rejected" || app.status === "withdrawn") {
    throw Object.assign(new Error("Cannot confirm a rejected application"), {
      status: 422,
    });
  }
  if (
    !["submitted", "under_review", "approved"].includes(app.status)
  ) {
    throw Object.assign(new Error("Application is not confirmable"), {
      status: 422,
    });
  }

  const isWorkshop =
    app.application_kind === "workshop" || Boolean(app.workshop_id);

  if (
    !isWorkshop &&
    !app.qualification_ok &&
    (app.eligible_qualifications?.length ?? 0) > 0
  ) {
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
    const seatsLeft = Array.isArray(batchRows)
      ? batchRows[0]?.seats_left
      : null;
    if (seatsLeft !== null && seatsLeft <= 0) {
      throw Object.assign(new Error("Batch has no seats left"), {
        status: 409,
      });
    }
  }

  const userId = await ensureStudentFromApplication(app);

  let enrollment;

  if (isWorkshop) {
    if (!app.workshop_id) {
      throw Object.assign(new Error("Workshop application missing workshop_id"), {
        status: 422,
      });
    }
    enrollment = await createEnrollment({
      user_id: userId,
      course_id: null,
      workshop_id: app.workshop_id,
      title:
        app.workshop_title ?? app.course_preference ?? "Workshop Enrollment",
      origin: "catalog",
      status: "active",
      currency: app.currency ?? "INR",
      agreed_price: opts?.agreed_price ?? app.quoted_price ?? null,
      batch_id: null,
      campus_id: app.preferred_campus_id,
      treatments: [],
      notes_internal: `Confirmed from application ${app.id}`,
    });

    await db.query(
      `UPDATE ${WORKSHOPS_TABLE}
       SET seats_left = GREATEST(COALESCE(seats_left, 0) - 1, 0),
           updated_at = now()
       WHERE id = $1 AND seats_left IS NOT NULL`,
      [app.workshop_id],
    );
  } else {
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

    enrollment = await createEnrollment({
      user_id: userId,
      course_id: courseId,
      workshop_id: null,
      title: app.course_title ?? app.course_preference ?? "Enrollment",
      origin: "catalog",
      status: "active",
      currency: app.currency ?? "INR",
      agreed_price: opts?.agreed_price ?? app.quoted_price ?? null,
      batch_id: batchId,
      campus_id: app.preferred_campus_id,
      treatments,
      notes_internal: `Confirmed from application ${app.id}`,
    });

    if (batchId) {
      await db.query(
        `UPDATE ${BATCHES_TABLE}
         SET seats_left = GREATEST(COALESCE(seats_left, 0) - 1, 0), updated_at = now()
         WHERE id = $1`,
        [batchId],
      );
    }
  }

  await db.query(
    `UPDATE ${ENROLLMENT_APPLICATIONS_TABLE}
     SET status = 'enrolled', user_id = $1, updated_at = now()
     WHERE id = $2`,
    [userId, applicationId],
  );

  return enrollment;
}
