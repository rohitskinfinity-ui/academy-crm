import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  STUDENT_CERTIFICATES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import {
  checkEnrollmentCompletion,
  syncEnrollmentProgress,
} from "./completionService";

export async function issueCertificate(enrollmentId: string) {
  const [enrRows] = await db.query<{
    user_id: string;
    course_id: string | null;
    title: string;
    batch_id: string | null;
  }>(
    `SELECT e.user_id, e.course_id, e.title, e.batch_id
     FROM ${ENROLLMENTS_TABLE} e WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [enrollmentId],
  );
  const enrollment = Array.isArray(enrRows) ? enrRows[0] : null;
  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const completion = await syncEnrollmentProgress(enrollmentId);
  if (!completion.eligible) {
    throw Object.assign(
      new Error(
        `Enrollment not eligible for certificate: ${completion.blockers.join("; ")}`,
      ),
      { status: 422, completion },
    );
  }

  const [existing] = await db.query(
    `SELECT id FROM ${STUDENT_CERTIFICATES_TABLE}
     WHERE enrollment_id = $1 AND revoked_at IS NULL`,
    [enrollmentId],
  );
  if (Array.isArray(existing) && existing.length > 0) {
    throw Object.assign(new Error("Certificate already issued"), { status: 409 });
  }

  const [courseRows] = await db.query<{ certificate_label: string | null; title: string }>(
    `SELECT certificate_label, title FROM ${COURSES_TABLE} WHERE id = $1`,
    [enrollment.course_id],
  );
  const course = Array.isArray(courseRows) ? courseRows[0] : null;
  const label = course?.certificate_label ?? "PGDCC";
  const year = new Date().getFullYear();

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${STUDENT_CERTIFICATES_TABLE}
     WHERE certificate_code LIKE $1`,
    [`${label}-${year}-%`],
  );
  const seq = parseInt(
    Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
    10,
  ) + 1;
  const certificateCode = `${label}-${year}-${String(seq).padStart(3, "0")}`;

  const certTitle =
    course?.title ?? enrollment.title ?? "PG Diploma in Clinical Cosmetology";

  const [rows] = await db.query(
    `INSERT INTO ${STUDENT_CERTIFICATES_TABLE}
       (user_id, enrollment_id, course_id, title, instructor_name, grade, certificate_code)
     VALUES ($1, $2, $3, $4, 'Skinfinity Academy Faculty', 'A', $5)
     RETURNING *`,
    [
      enrollment.user_id,
      enrollmentId,
      enrollment.course_id,
      certTitle,
      certificateCode,
    ],
  );

  await db.query(
    `UPDATE ${ENROLLMENTS_TABLE}
     SET status = 'completed', completed_at = now(), progress_pct = 100, updated_at = now()
     WHERE id = $1`,
    [enrollmentId],
  );

  return Array.isArray(rows) ? rows[0] : null;
}

export async function getEnrollmentCertificate(enrollmentId: string) {
  const [rows] = await db.query(
    `SELECT * FROM ${STUDENT_CERTIFICATES_TABLE}
     WHERE enrollment_id = $1 AND revoked_at IS NULL
     ORDER BY issued_at DESC LIMIT 1`,
    [enrollmentId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getCompletionStatus(enrollmentId: string) {
  return checkEnrollmentCompletion(enrollmentId);
}
