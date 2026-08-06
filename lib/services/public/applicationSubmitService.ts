import { db, withTransaction } from "@/lib/db";
import {
  CONTACT_INQUIRIES_TABLE,
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  LEADS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import {
  buildEnrollmentAttachmentPath,
  uploadFileToGcp,
} from "@/lib/gcp/storage";

type ApplicationInput = {
  application_kind?: "course" | "workshop";
  full_name: string;
  guardian_name?: string | null;
  course_preference?: string | null;
  course_slug?: string | null;
  course_id?: string | null;
  workshop_id?: string | null;
  workshop_slug?: string | null;
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
  photo_name?: string | null;
  photo_base64?: string | null;
  doc_name?: string | null;
  doc_base64?: string | null;
  notes?: string | null;
  accepted_terms: boolean;
};

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function parseBase64Attachment(
  raw: string,
  fallbackType: string,
): { buffer: Buffer; contentType: string } {
  const trimmed = raw.trim();
  const dataUrl = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  const contentType = dataUrl?.[1] || fallbackType;
  const b64 = dataUrl?.[2] || trimmed;
  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) {
    throw Object.assign(new Error("Invalid attachment data"), { status: 400 });
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw Object.assign(new Error("Attachment exceeds 8MB limit"), {
      status: 400,
    });
  }
  return { buffer, contentType };
}

async function uploadApplicationAttachments(
  registrationId: string,
  input: ApplicationInput,
): Promise<{ photo_url: string | null; document_url: string | null }> {
  let photo_url = input.photo_url?.trim() || null;
  let document_url = input.document_url?.trim() || null;

  if (!photo_url && input.photo_base64?.trim()) {
    const { buffer, contentType } = parseBase64Attachment(
      input.photo_base64,
      "image/jpeg",
    );
    const ext =
      contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
    const fileName = input.photo_name?.trim() || `photo.${ext}`;
    const destination = buildEnrollmentAttachmentPath({
      registrationId,
      kind: "photo",
      fileName,
    });
    const uploaded = await uploadFileToGcp({
      buffer,
      destination,
      contentType,
      bucket: "public",
    });
    photo_url = uploaded.url;
  }

  if (!document_url && input.doc_base64?.trim()) {
    const { buffer, contentType } = parseBase64Attachment(
      input.doc_base64,
      "application/pdf",
    );
    const fileName = input.doc_name?.trim() || "qualification.pdf";
    const destination = buildEnrollmentAttachmentPath({
      registrationId,
      kind: "documents",
      fileName,
    });
    const uploaded = await uploadFileToGcp({
      buffer,
      destination,
      contentType,
      bucket: "public",
    });
    document_url = uploaded.url;
  }

  return { photo_url, document_url };
}

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

async function resolveWorkshop(input: ApplicationInput): Promise<{
  workshop_id: string;
  title: string;
  slug: string;
  price: number | null;
  currency: string;
}> {
  if (input.workshop_id) {
    const [rows] = await db.query<{
      id: string;
      title: string;
      slug: string;
      price: number | null;
      currency: string;
    }>(
      `SELECT id, title, slug, price, currency FROM ${WORKSHOPS_TABLE}
       WHERE id = $1 AND deleted_at IS NULL
         AND is_published = true AND status = 'published'`,
      [input.workshop_id],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw Object.assign(new Error("Workshop not found"), { status: 404 });
    }
    return {
      workshop_id: row.id,
      title: row.title,
      slug: row.slug,
      price: row.price != null ? Number(row.price) : null,
      currency: row.currency || "INR",
    };
  }

  if (input.workshop_slug?.trim()) {
    const [rows] = await db.query<{
      id: string;
      title: string;
      slug: string;
      price: number | null;
      currency: string;
    }>(
      `SELECT id, title, slug, price, currency FROM ${WORKSHOPS_TABLE}
       WHERE slug = $1 AND deleted_at IS NULL
         AND is_published = true AND status = 'published'`,
      [input.workshop_slug.trim()],
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) {
      throw Object.assign(new Error("Workshop not found"), { status: 404 });
    }
    return {
      workshop_id: row.id,
      title: row.title,
      slug: row.slug,
      price: row.price != null ? Number(row.price) : null,
      currency: row.currency || "INR",
    };
  }

  throw Object.assign(new Error("Workshop is required"), { status: 400 });
}

function makeRegistrationId() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SA-${year}-${suffix}`;
}

/**
 * Workshop interest: store enrollment_application + contact enquiry (no LMS enrollment).
 */
async function submitWorkshopApplication(input: ApplicationInput) {
  const workshop = await resolveWorkshop(input);
  const registrationId = makeRegistrationId();
  const email = input.email.toLowerCase().trim();
  const nameParts = input.full_name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? input.full_name;
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
  const topic = `Workshop: ${workshop.title}`;
  const message = [
    `Workshop application for ${workshop.title}`,
    input.highest_qualification
      ? `Qualification: ${input.highest_qualification}`
      : null,
    input.profession ? `Profession: ${input.profession}` : null,
    input.source ? `Source: ${input.source}` : null,
    `Registration: ${registrationId}`,
  ]
    .filter(Boolean)
    .join("\n");

  const attachments = await uploadApplicationAttachments(
    registrationId,
    input,
  );

  const result = await withTransaction(async (conn) => {
    const [leadRows] = await conn.query<{ id: string }>(
      `INSERT INTO ${LEADS_TABLE}
         (channel, full_name, email, phone, message, meta, status)
       VALUES ('enroll', $1, $2, $3, $4, $5::jsonb, 'new')
       RETURNING id`,
      [
        input.full_name,
        email,
        input.whatsapp,
        topic,
        JSON.stringify({
          source: input.source ?? null,
          workshop_id: workshop.workshop_id,
          workshop_slug: workshop.slug,
          registration_id: registrationId,
          application_kind: "workshop",
          photo_url: attachments.photo_url,
          document_url: attachments.document_url,
        }),
      ],
    );
    const leadId = Array.isArray(leadRows) ? leadRows[0]?.id : undefined;
    if (!leadId) {
      throw Object.assign(new Error("Failed to create lead"), { status: 500 });
    }

    await conn.query(
      `INSERT INTO ${CONTACT_INQUIRIES_TABLE}
         (lead_id, first_name, last_name, email, phone, topic, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        leadId,
        firstName,
        lastName,
        email,
        input.whatsapp,
        topic,
        message,
      ],
    );

    const [appRows] = await conn.query<{
      id: string;
      created_at: string;
    }>(
      `INSERT INTO ${ENROLLMENT_APPLICATIONS_TABLE}
         (registration_id, lead_id, full_name, guardian_name, course_preference,
          course_id, workshop_id, application_kind, date_of_birth, gender,
          highest_qualification, profession, medical_background, registration_no,
          currently_working, whatsapp, alternate_no, email, address, city_state,
          pin_code, source, payment_option, quoted_price, currency,
          photo_url, document_url, accepted_terms, status)
       VALUES (
         $1,$2,$3,$4,$5,NULL,$6,'workshop',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,'submitted'
       )
       RETURNING id, created_at::text AS created_at`,
      [
        registrationId,
        leadId,
        input.full_name,
        input.guardian_name ?? null,
        workshop.title,
        workshop.workshop_id,
        input.date_of_birth || null,
        input.gender ?? null,
        input.highest_qualification ?? null,
        input.profession ?? null,
        input.medical_background ?? null,
        input.registration_no ?? null,
        input.currently_working ?? null,
        input.whatsapp,
        input.alternate_no ?? null,
        email,
        input.address ?? null,
        input.city_state ?? null,
        input.pin_code ?? null,
        input.source ?? null,
        input.payment_option ?? null,
        input.quoted_price ?? workshop.price,
        input.currency || workshop.currency || "INR",
        attachments.photo_url,
        attachments.document_url,
        true,
      ],
    );

    const app = Array.isArray(appRows) ? appRows[0] : null;
    if (!app?.id) {
      throw Object.assign(new Error("Failed to create application"), {
        status: 500,
      });
    }

    return app;
  });

  return {
    id: result.id,
    registration_id: registrationId,
    status: "submitted",
    created_at: result.created_at,
    application_kind: "workshop" as const,
    workshop_id: workshop.workshop_id,
  };
}

/**
 * Public enroll: create a pending enrollment_application lead.
 * Staff confirms after QR payment → student + enrollment.
 */
export async function submitApplication(input: ApplicationInput) {
  if (!input.accepted_terms) {
    throw Object.assign(new Error("Terms must be accepted"), { status: 400 });
  }

  if (input.application_kind === "workshop") {
    return submitWorkshopApplication(input);
  }

  return submitCourseApplication(input);
}

async function submitCourseApplication(input: ApplicationInput) {
  const course = await resolveCourse(input);
  const registrationId = makeRegistrationId();
  const email = input.email.toLowerCase().trim();
  const nameParts = input.full_name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? input.full_name;
  const lastName =
    nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
  const topic = `Course: ${course.title}`;
  const message = [
    `Course application for ${course.title}`,
    input.highest_qualification
      ? `Qualification: ${input.highest_qualification}`
      : null,
    input.profession ? `Profession: ${input.profession}` : null,
    input.source ? `Source: ${input.source}` : null,
    `Registration: ${registrationId}`,
  ]
    .filter(Boolean)
    .join("\n");

  const attachments = await uploadApplicationAttachments(
    registrationId,
    input,
  );

  const result = await withTransaction(async (conn) => {
    const [leadRows] = await conn.query<{ id: string }>(
      `INSERT INTO ${LEADS_TABLE}
         (channel, full_name, email, phone, message, meta, status)
       VALUES ('enroll', $1, $2, $3, $4, $5::jsonb, 'new')
       RETURNING id`,
      [
        input.full_name,
        email,
        input.whatsapp,
        topic,
        JSON.stringify({
          source: input.source ?? null,
          course_id: course.course_id,
          course_slug: input.course_slug ?? null,
          registration_id: registrationId,
          application_kind: "course",
          photo_url: attachments.photo_url,
          document_url: attachments.document_url,
        }),
      ],
    );
    const leadId = Array.isArray(leadRows) ? leadRows[0]?.id : undefined;
    if (!leadId) {
      throw Object.assign(new Error("Failed to create lead"), { status: 500 });
    }

    await conn.query(
      `INSERT INTO ${CONTACT_INQUIRIES_TABLE}
         (lead_id, first_name, last_name, email, phone, topic, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        leadId,
        firstName,
        lastName,
        email,
        input.whatsapp,
        topic,
        message,
      ],
    );

    const [appRows] = await conn.query<{
      id: string;
      created_at: string;
    }>(
      `INSERT INTO ${ENROLLMENT_APPLICATIONS_TABLE}
         (registration_id, lead_id, full_name, guardian_name, course_preference,
          course_id, workshop_id, application_kind, date_of_birth, gender,
          highest_qualification, profession, medical_background, registration_no,
          currently_working, whatsapp, alternate_no, email, address, city_state,
          pin_code, source, preferred_campus_id, training_mode, preferred_batch_id,
          quoted_price, currency, photo_url, document_url, accepted_terms, status)
       VALUES (
         $1,$2,$3,$4,$5,$6,NULL,'course',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
         $17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,'submitted'
       )
       RETURNING id, created_at::text AS created_at`,
      [
        registrationId,
        leadId,
        input.full_name,
        input.guardian_name ?? null,
        course.title,
        course.course_id,
        input.date_of_birth || null,
        input.gender ?? null,
        input.highest_qualification ?? null,
        input.profession ?? null,
        input.medical_background ?? null,
        input.registration_no ?? null,
        input.currently_working ?? null,
        input.whatsapp,
        input.alternate_no ?? null,
        email,
        input.address ?? null,
        input.city_state ?? null,
        input.pin_code ?? null,
        input.source ?? null,
        input.preferred_campus_id ?? null,
        input.training_mode ?? null,
        input.preferred_batch_id ?? null,
        input.quoted_price ??
          (course.list_price != null ? Number(course.list_price) : null),
        input.currency || "INR",
        attachments.photo_url,
        attachments.document_url,
        true,
      ],
    );

    const app = Array.isArray(appRows) ? appRows[0] : null;
    if (!app?.id) {
      throw Object.assign(new Error("Failed to create application"), {
        status: 500,
      });
    }
    return app;
  });

  return {
    id: result.id,
    registration_id: registrationId,
    status: "submitted",
    created_at: result.created_at,
    application_kind: "course" as const,
    course_id: course.course_id,
  };
}
