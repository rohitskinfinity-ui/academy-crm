import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENTS_TABLE,
  STUDENT_CERTIFICATES_TABLE,
  USERS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import {
  checkCertificateEligibility,
  type CertificateEligibility,
} from "@/lib/certificates/eligibility";
import {
  CERT_INSTRUCTOR_NAME,
  gradeFromPercent,
} from "@/lib/certificates/constants";
import { renderCertificatePdf } from "@/lib/certificates/renderCertificatePdf";
import {
  buildCertificatePath,
  getGcpSignedUrl,
  uploadFileToGcp,
} from "@/lib/gcp/storage";
import { checkEnrollmentCompletion } from "./completionService";

export type StudentCertificateRow = {
  id: string;
  user_id: string;
  enrollment_id: string | null;
  course_id: string | null;
  title: string;
  recipient_name: string | null;
  instructor_name: string | null;
  grade: string | null;
  certificate_code: string;
  verify_token: string;
  pdf_url: string | null;
  issued_at: string;
  created_at: string;
  revoked_at: string | null;
};

async function loadIssueContext(enrollmentId: string) {
  const [enrRows] = await db.query<{
    user_id: string;
    course_id: string | null;
    workshop_id: string | null;
    title: string;
  }>(
    `SELECT e.user_id, e.course_id, e.workshop_id, e.title
     FROM ${ENROLLMENTS_TABLE} e WHERE e.id = $1 AND e.deleted_at IS NULL`,
    [enrollmentId],
  );
  const enrollment = Array.isArray(enrRows) ? enrRows[0] : null;
  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const [userRows] = await db.query<{
    full_name: string;
    display_name: string | null;
  }>(
    `SELECT full_name, display_name FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [enrollment.user_id],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;

  const [courseRows] = await db.query<{
    certificate_label: string | null;
    title: string;
    duration_label: string | null;
  }>(
    `SELECT certificate_label, title, duration_label
     FROM ${COURSES_TABLE} WHERE id = $1`,
    [enrollment.course_id],
  );
  const course = Array.isArray(courseRows) ? courseRows[0] : null;

  const [workshopRows] = await db.query<{
    title: string;
    duration_label: string | null;
  }>(
    `SELECT title, duration_label
     FROM ${WORKSHOPS_TABLE} WHERE id = $1 AND deleted_at IS NULL`,
    [enrollment.workshop_id],
  );
  const workshop = Array.isArray(workshopRows) ? workshopRows[0] : null;

  return {
    enrollment,
    recipientName:
      user?.full_name?.trim() || user?.display_name?.trim() || "Student",
    course,
    workshop,
    programTitle:
      course?.title || workshop?.title || enrollment.title || "Certificate",
    durationLabel: course?.duration_label ?? workshop?.duration_label ?? null,
  };
}

const ALLOWED_CERT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

function extensionForContentType(contentType: string, fileName: string) {
  const fromName = fileName.split(".").pop()?.toLowerCase();
  if (fromName && ["pdf", "png", "jpg", "jpeg"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("png")) return "png";
  return "jpg";
}

function inferContentType(fileName: string, contentType: string) {
  const given = (contentType || "").toLowerCase();
  if (ALLOWED_CERT_TYPES.has(given)) {
    return given === "image/jpg" ? "image/jpeg" : given;
  }
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return given;
}

export async function attachEnrollmentCertificate(
  enrollmentId: string,
  file: { buffer: Buffer; fileName: string; contentType: string },
) {
  const contentType = inferContentType(file.fileName, file.contentType);
  if (!ALLOWED_CERT_TYPES.has(contentType)) {
    throw Object.assign(
      new Error("Certificate must be a PDF, JPG, or PNG file"),
      { status: 400 },
    );
  }
  if (!file.buffer.length) {
    throw Object.assign(new Error("Empty file"), { status: 400 });
  }

  const { enrollment, recipientName, course, workshop, programTitle } =
    await loadIssueContext(enrollmentId);
  if (!enrollment.course_id && !enrollment.workshop_id) {
    throw Object.assign(
      new Error(
        "Certificates can only be attached to course or workshop enrollments",
      ),
      { status: 422 },
    );
  }

  const eligibility = await checkCertificateEligibility(enrollmentId);
  const grade =
    eligibility.quiz_best_percent != null
      ? gradeFromPercent(eligibility.quiz_best_percent)
      : null;
  const certTitle = programTitle || enrollment.title || "Certificate";

  const ext = extensionForContentType(contentType, file.fileName);
  const destination = buildCertificatePath({
    enrollmentId,
    fileName: `certificate.${ext}`,
  });
  const uploaded = await uploadFileToGcp({
    buffer: file.buffer,
    destination,
    contentType,
  });

  const existing = await getEnrollmentCertificate(enrollmentId);
  if (existing) {
    const [updated] = await db.query<StudentCertificateRow>(
      `UPDATE ${STUDENT_CERTIFICATES_TABLE}
       SET pdf_url = $1,
           recipient_name = $2,
           title = $3,
           instructor_name = $4,
           grade = COALESCE($5, grade),
           issued_at = now()
       WHERE id = $6
       RETURNING *`,
      [
        uploaded.url,
        recipientName,
        certTitle,
        CERT_INSTRUCTOR_NAME,
        grade,
        existing.id,
      ],
    );
    return Array.isArray(updated) ? updated[0] : existing;
  }

  const label =
    course?.certificate_label ||
    (workshop ? "WS" : enrollment.workshop_id ? "WS" : "PGDCC");
  const year = new Date().getFullYear();
  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${STUDENT_CERTIFICATES_TABLE}
     WHERE certificate_code LIKE $1`,
    [`${label}-${year}-%`],
  );
  const seq =
    parseInt(Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0", 10) +
    1;
  const certificateCode = `${label}-${year}-${String(seq).padStart(3, "0")}`;

  const [rows] = await db.query<StudentCertificateRow>(
    `INSERT INTO ${STUDENT_CERTIFICATES_TABLE}
       (user_id, enrollment_id, course_id, title, recipient_name,
        instructor_name, grade, certificate_code, pdf_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      enrollment.user_id,
      enrollmentId,
      enrollment.course_id,
      certTitle,
      recipientName,
      CERT_INSTRUCTOR_NAME,
      grade,
      certificateCode,
      uploaded.url,
    ],
  );
  const cert = Array.isArray(rows) ? rows[0] : null;
  if (!cert) {
    throw Object.assign(new Error("Failed to attach certificate"), {
      status: 500,
    });
  }
  return cert;
}

export async function getEnrollmentCertificate(enrollmentId: string) {
  const [rows] = await db.query<StudentCertificateRow>(
    `SELECT * FROM ${STUDENT_CERTIFICATES_TABLE}
     WHERE enrollment_id = $1 AND revoked_at IS NULL
     ORDER BY issued_at DESC LIMIT 1`,
    [enrollmentId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getCompletionStatus(enrollmentId: string) {
  const [completion, eligibility] = await Promise.all([
    checkEnrollmentCompletion(enrollmentId),
    checkCertificateEligibility(enrollmentId),
  ]);
  return { ...completion, cert_eligibility: eligibility };
}

export async function signCertificatePdfUrl(
  pdfUrl: string | null | undefined,
  expiresInMinutes = 15,
) {
  if (!pdfUrl) return "";
  return getGcpSignedUrl(pdfUrl, expiresInMinutes);
}

export async function previewEnrollmentCertificate(enrollmentId: string) {
  const { enrollment, recipientName, programTitle, durationLabel } =
    await loadIssueContext(enrollmentId);
  if (!enrollment.course_id && !enrollment.workshop_id) {
    throw Object.assign(
      new Error(
        "Certificate preview is only available for course or workshop enrollments",
      ),
      { status: 422 },
    );
  }

  const cert = await getEnrollmentCertificate(enrollmentId);
  const courseTitle = cert?.title || programTitle || enrollment.title || "Certificate";

  if (cert?.pdf_url) {
    const url = await signCertificatePdfUrl(cert.pdf_url, 15);
    return {
      url,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      issued: true,
      certificate_code: cert.certificate_code,
      recipient_name: cert.recipient_name || recipientName,
      title: courseTitle,
      content_type: guessCertContentType(cert.pdf_url),
    };
  }

  const bytes = await renderCertificatePdf({
    recipientName,
    courseTitle,
    durationLabel: durationLabel,
    issuedAt: new Date(),
    certificateCode: null,
    watermark: "NOT YET AWARDED",
  });
  return {
    url: `data:application/pdf;base64,${Buffer.from(bytes).toString("base64")}`,
    expires_at: null,
    issued: false,
    certificate_code: null,
    recipient_name: recipientName,
    title: courseTitle,
    content_type: "application/pdf",
  };
}

function guessCertContentType(url: string) {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/pdf";
}

export type { CertificateEligibility };
