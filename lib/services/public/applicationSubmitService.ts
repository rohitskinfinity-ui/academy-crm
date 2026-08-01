import { db } from "@/lib/db";
import {
  BATCHES_TABLE,
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  LEADS_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { createEnrollment } from "@/lib/services/admin/enrollmentService";
import crypto from "crypto";

type ApplicationInput = {
  full_name: string;
  guardian_name?: string | null;
  course_preference?: string | null;
  course_slug?: string | null;
  course_id?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  highest_qualification?: string | null;
  profession?: string | null;
  medical_background?: string | null;
  registration_no?: string | null;
  currently_working?: string | null;
  whatsapp: string;
  alternate_no?: string | null;
  email: string;
  address?: string | null;
  city_state?: string | null;
  pin_code?: string | null;
  source?: string | null;
  preferred_campus_id?: string | null;
  training_mode?: string | null;
  preferred_batch_id?: string | null;
  payment_option?: string | null;
  quoted_price?: number | null;
  currency: string;
  photo_url?: string | null;
  document_url?: string | null;
  accepted_terms: boolean;
};

async function resolveCourse(input: ApplicationInput): Promise<{
  course_id: string;
  title: string;
  list_price: number | null;
}> {
  if (input.course_id) {
    const [rows] = await db.query<{
      id: string;
      title: string;
      list_price: number | null;
    }>(
      `SELECT id, title, list_price FROM ${COURSES_TABLE}
       WHERE id = $1 AND deleted_at IS NULL AND status = 'published'`,
      [input.course_id],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw Object.assign(new Error("Course not found"), { status: 404 });
    }
    return {
      course_id: row.id,
      title: row.title,
      list_price: row.list_price,
    };
  }

  if (input.course_slug?.trim()) {
    const [rows] = await db.query<{
      id: string;
      title: string;
      list_price: number | null;
    }>(
      `SELECT id, title, list_price FROM ${COURSES_TABLE}
       WHERE slug = $1 AND deleted_at IS NULL AND status = 'published'`,
      [input.course_slug.trim()],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw Object.assign(new Error("Course not found"), { status: 404 });
    }
    return {
      course_id: row.id,
      title: row.title,
      list_price: row.list_price,
    };
  }

  if (input.course_preference?.trim()) {
    const [rows] = await db.query<{
      id: string;
      title: string;
      list_price: number | null;
    }>(
      `SELECT id, title, list_price FROM ${COURSES_TABLE}
       WHERE deleted_at IS NULL AND status = 'published'
         AND (title ILIKE $1 OR slug ILIKE $1)
       LIMIT 1`,
      [input.course_preference.trim()],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw Object.assign(new Error("Course not found"), { status: 404 });
    }
    return {
      course_id: row.id,
      title: row.title,
      list_price: row.list_price,
    };
  }

  throw Object.assign(new Error("Course is required"), { status: 400 });
}

function makeRegistrationId() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SA-${year}-${suffix}`;
}

async function findOrCreateStudent(input: ApplicationInput): Promise<string> {
  const email = input.email.toLowerCase().trim();
  const [existing] = await db.query<{ id: string }>(
    `SELECT id FROM ${USERS_TABLE}
     WHERE lower(email) = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  let userId = Array.isArray(existing) ? existing[0]?.id ?? null : null;

  if (!userId) {
    const passwordHash = await hashPassword(`SA-${crypto.randomUUID()}`);
    const [userRows] = await db.query<{ id: string }>(
      `INSERT INTO ${USERS_TABLE}
         (email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'student', true)
       RETURNING id`,
      [email, input.full_name, passwordHash],
    );
    userId = Array.isArray(userRows) ? userRows[0]?.id ?? null : null;
  } else {
    await db.query(
      `UPDATE ${USERS_TABLE}
       SET full_name = COALESCE(NULLIF($1, ''), full_name), updated_at = now()
       WHERE id = $2`,
      [input.full_name, userId],
    );
  }

  if (!userId) {
    throw Object.assign(new Error("Failed to create student account"), {
      status: 500,
    });
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
      input.whatsapp,
      input.whatsapp,
      input.alternate_no ?? null,
      input.address ?? null,
      input.city_state ?? null,
      input.pin_code ?? null,
      input.date_of_birth || null,
      input.gender ?? null,
      input.course_preference ?? null,
      input.highest_qualification ?? null,
      input.profession ?? null,
      input.medical_background ?? null,
      input.registration_no ?? null,
      input.currently_working ?? null,
      input.guardian_name ?? null,
    ],
  );

  return userId;
}

/**
 * Public course purchase: create (or reuse) student + enrollment directly.
 * Does not create an enrollment_application row — enquiries go through contact form.
 */
export async function submitApplication(input: ApplicationInput) {
  if (!input.accepted_terms) {
    throw Object.assign(new Error("Terms must be accepted"), { status: 400 });
  }

  const course = await resolveCourse(input);
  const registrationId = makeRegistrationId();
  const email = input.email.toLowerCase().trim();

  await db.query(
    `INSERT INTO ${LEADS_TABLE}
       (channel, full_name, email, phone, message, meta, status)
     VALUES ('enroll', $1, $2, $3, $4, $5::jsonb, 'converted')`,
    [
      input.full_name,
      email,
      input.whatsapp,
      course.title,
      JSON.stringify({
        source: input.source ?? null,
        course_id: course.course_id,
        course_slug: input.course_slug ?? null,
        registration_id: registrationId,
        payment_option: input.payment_option ?? null,
      }),
    ],
  );

  const userId = await findOrCreateStudent(input);

  const [existingEnroll] = await db.query<{ id: string; created_at: string }>(
    `SELECT id, created_at::text AS created_at FROM ${ENROLLMENTS_TABLE}
     WHERE user_id = $1 AND course_id = $2 AND deleted_at IS NULL
       AND status IN ('active', 'completed')
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, course.course_id],
  );
  const existing = Array.isArray(existingEnroll) ? existingEnroll[0] : null;
  if (existing) {
    return {
      id: existing.id,
      enrollment_id: existing.id,
      registration_id: registrationId,
      status: "enrolled",
      created_at: existing.created_at,
      already_enrolled: true,
    };
  }

  const enrollment = (await createEnrollment({
    user_id: userId,
    course_id: course.course_id,
    title: course.title,
    origin: "catalog",
    status: "active",
    currency: input.currency || "INR",
    agreed_price:
      input.quoted_price ??
      (course.list_price != null ? Number(course.list_price) : null),
    batch_id: input.preferred_batch_id ?? null,
    campus_id: input.preferred_campus_id ?? null,
    notes_internal: `Purchase ${registrationId}${input.source ? ` · source: ${input.source}` : ""}`,
  })) as { id?: string; created_at?: string } | null;

  if (!enrollment?.id) {
    throw Object.assign(new Error("Failed to create enrollment"), {
      status: 500,
    });
  }

  if (input.preferred_batch_id) {
    await db.query(
      `UPDATE ${BATCHES_TABLE}
       SET seats_left = GREATEST(COALESCE(seats_left, 0) - 1, 0), updated_at = now()
       WHERE id = $1`,
      [input.preferred_batch_id],
    );
  }

  return {
    id: enrollment.id,
    enrollment_id: enrollment.id,
    registration_id: registrationId,
    status: "enrolled",
    created_at: enrollment.created_at
      ? String(enrollment.created_at)
      : new Date().toISOString(),
    already_enrolled: false,
  };
}
