import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  STUDENT_CERTIFICATES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { checkCertificateEligibility } from "@/lib/certificates/eligibility";
import { CERT_INSTRUCTOR_NAME } from "@/lib/certificates/constants";
import { renderCertificatePdf } from "@/lib/certificates/renderCertificatePdf";
import { getOwnedEnrollment } from "./access";
import {
  getEnrollmentCertificate,
  signCertificatePdfUrl,
  type StudentCertificateRow,
} from "@/lib/services/admin/certificateService";

const PREVIEW_TTL_MINUTES = 15;

export type CertificateCardStatus =
  | "issued"
  | "awaiting_admin"
  | "quiz_ready"
  | "quiz_failed"
  | "quiz_locked"
  | "in_progress";

function cardStatus(input: {
  issued: boolean;
  eligible: boolean;
  progressMet: boolean;
  quizPublished: boolean;
  quizPassed: boolean;
  quizBest: number | null;
}): CertificateCardStatus {
  if (input.issued && input.eligible) return "issued";
  if (input.eligible && !input.issued) return "awaiting_admin";
  if (!input.progressMet) return input.quizPublished ? "quiz_locked" : "in_progress";
  if (!input.quizPublished) return "in_progress";
  if (input.quizBest != null && !input.quizPassed) return "quiz_failed";
  return "quiz_ready";
}

export async function listStudentCertificates(userId: string) {
  const [userRows] = await db.query<{
    full_name: string;
    display_name: string | null;
  }>(
    `SELECT full_name, display_name FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  const studentName =
    user?.full_name?.trim() || user?.display_name?.trim() || "Student";

  const [enrRows] = await db.query<{
    id: string;
    title: string;
    status: string;
    progress_pct: number;
    course_id: string | null;
    course_title: string | null;
    duration_label: string | null;
  }>(
    `SELECT e.id, e.title, e.status::text AS status,
            e.progress_pct::float8 AS progress_pct, e.course_id,
            c.title AS course_title, c.duration_label
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id AND c.deleted_at IS NULL
     WHERE e.user_id = $1
       AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')
       AND e.course_id IS NOT NULL
     ORDER BY e.created_at DESC`,
    [userId],
  );
  const enrollments = Array.isArray(enrRows) ? enrRows : [];

  const cards = [];
  for (const enr of enrollments) {
    const [eligibility, cert] = await Promise.all([
      checkCertificateEligibility(enr.id),
      getEnrollmentCertificate(enr.id),
    ]);
    const issued = Boolean(cert?.pdf_url);
    const status = cardStatus({
      issued,
      eligible: eligibility.eligible,
      progressMet: eligibility.progress_met,
      quizPublished: eligibility.quiz_published,
      quizPassed: eligibility.quiz_passed,
      quizBest: eligibility.quiz_best_percent,
    });
    cards.push({
      enrollment_id: enr.id,
      status,
      student_name: cert?.recipient_name || studentName,
      title: cert?.title || enr.course_title || enr.title,
      certificate_code: cert?.certificate_code ?? null,
      grade: cert?.grade ?? null,
      issued_at: cert?.issued_at ?? null,
      instructor_name: cert?.instructor_name || CERT_INSTRUCTOR_NAME,
      progress_pct: eligibility.progress_pct,
      quiz_unlocked: eligibility.quiz_unlocked,
      quiz_best_percent: eligibility.quiz_best_percent,
      quiz_pass_percent: eligibility.quiz_pass_percent,
      can_download: issued && eligibility.eligible,
      has_file: issued,
      blockers: eligibility.blockers,
      verify_url: issued
        ? `/api/public/certificates/verify/${encodeURIComponent(cert!.certificate_code)}`
        : null,
    });
  }

  return { student_name: studentName, certificates: cards };
}

export async function getStudentCertificateDetail(
  userId: string,
  enrollmentId: string,
) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment?.course_id) {
    throw Object.assign(new Error("Certificate enrollment not found"), {
      status: 404,
    });
  }
  const list = await listStudentCertificates(userId);
  const card = list.certificates.find((c) => c.enrollment_id === enrollmentId);
  if (!card) {
    throw Object.assign(new Error("Certificate enrollment not found"), {
      status: 404,
    });
  }
  const eligibility = await checkCertificateEligibility(enrollmentId);
  const cert = await getEnrollmentCertificate(enrollmentId);
  return { ...card, eligibility, certificate: cert };
}

async function previewPdfBytes(input: {
  recipientName: string;
  courseTitle: string;
  durationLabel?: string | null;
  issuedAt: Date | string;
  certificateCode?: string | null;
  watermark?: string | null;
}) {
  return renderCertificatePdf(input);
}

export async function previewStudentCertificate(
  userId: string,
  enrollmentId: string,
) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment?.course_id) {
    throw Object.assign(new Error("Certificate enrollment not found"), {
      status: 404,
    });
  }

  const [userRows] = await db.query<{
    full_name: string;
    display_name: string | null;
  }>(
    `SELECT full_name, display_name FROM ${USERS_TABLE} WHERE id = $1`,
    [userId],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;
  const [courseRows] = await db.query<{
    title: string;
    duration_label: string | null;
  }>(
    `SELECT title, duration_label FROM ${COURSES_TABLE} WHERE id = $1`,
    [enrollment.course_id],
  );
  const course = Array.isArray(courseRows) ? courseRows[0] : null;
  const cert = await getEnrollmentCertificate(enrollmentId);

  if (cert?.pdf_url) {
    const url = await signCertificatePdfUrl(cert.pdf_url, PREVIEW_TTL_MINUTES);
    return {
      url,
      expires_at: new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000).toISOString(),
      issued: true,
      certificate_code: cert.certificate_code,
      content_type: guessCertContentType(cert.pdf_url),
    };
  }

  const bytes = await previewPdfBytes({
    recipientName:
      user?.full_name?.trim() || user?.display_name?.trim() || "Student",
    courseTitle: course?.title || enrollment.title,
    durationLabel: course?.duration_label,
    issuedAt: new Date(),
    certificateCode: null,
    watermark: "NOT YET AWARDED",
  });
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    url: `data:application/pdf;base64,${base64}`,
    expires_at: null,
    issued: false,
    certificate_code: null,
    content_type: "application/pdf",
  };
}

function guessCertContentType(url: string) {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/pdf";
}

export async function downloadStudentCertificate(
  userId: string,
  enrollmentId: string,
) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment?.course_id) {
    throw Object.assign(new Error("Certificate enrollment not found"), {
      status: 404,
    });
  }

  const eligibility = await checkCertificateEligibility(enrollmentId);
  const cert = await getEnrollmentCertificate(enrollmentId);

  if (!eligibility.eligible) {
    throw Object.assign(
      new Error(
        `Certificate not available: ${eligibility.blockers.join("; ") || "requirements not met"}`,
      ),
      { status: 403, eligibility },
    );
  }
  if (!cert?.pdf_url) {
    throw Object.assign(
      new Error("Certificate has not been issued by admin yet"),
      { status: 403 },
    );
  }

  const url = await signCertificatePdfUrl(cert.pdf_url, PREVIEW_TTL_MINUTES);
  const ext = cert.pdf_url.match(/\.(pdf|png|jpe?g)(\?|$)/i)?.[1] || "pdf";
  return {
    url,
    expires_at: new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000).toISOString(),
    filename: `${cert.certificate_code}.${ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase()}`,
    certificate_code: cert.certificate_code,
  };
}

export async function verifyPublicCertificate(code: string) {
  const token = code.trim();
  if (!token) {
    throw Object.assign(new Error("Certificate code required"), { status: 400 });
  }
  const [rows] = await db.query<
    StudentCertificateRow & {
      student_name: string | null;
      course_title: string | null;
    }
  >(
    `SELECT sc.*,
            COALESCE(sc.recipient_name, u.full_name) AS student_name,
            c.title AS course_title
     FROM ${STUDENT_CERTIFICATES_TABLE} sc
     LEFT JOIN ${USERS_TABLE} u ON u.id = sc.user_id
     LEFT JOIN ${COURSES_TABLE} c ON c.id = sc.course_id
     WHERE sc.revoked_at IS NULL
       AND (sc.certificate_code = $1 OR sc.verify_token = $1)
     LIMIT 1`,
    [token],
  );
  const cert = Array.isArray(rows) ? rows[0] : null;
  if (!cert) {
    throw Object.assign(new Error("Certificate not found"), { status: 404 });
  }
  return {
    valid: true,
    certificate_code: cert.certificate_code,
    student_name: cert.student_name || cert.recipient_name,
    title: cert.title || cert.course_title,
    grade: cert.grade,
    instructor_name: cert.instructor_name || CERT_INSTRUCTOR_NAME,
    issued_at: cert.issued_at,
  };
}
