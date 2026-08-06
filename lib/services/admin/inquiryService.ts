import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import {
  CONTACT_INQUIRIES_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENT_APPLICATIONS_TABLE,
  INQUIRY_COMMENTS_TABLE,
  INQUIRY_HISTORY_TABLE,
  LEADS_TABLE,
  PAYMENTS_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import { createEnrollment } from "./enrollmentService";

export const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "follow_up",
  "converted",
  "lost",
  "closed",
  "spam",
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export type ContactInquiryRow = {
  id: string;
  lead_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  topic: string | null;
  message: string | null;
  status: string;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  enrollment_id: string | null;
  converted_at: string | null;
  channel: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

const LIST_SELECT = `
  ci.id,
  ci.lead_id,
  ci.first_name,
  ci.last_name,
  trim(concat(coalesce(ci.first_name, ''), ' ', coalesce(ci.last_name, ''))) AS full_name,
  ci.email,
  ci.phone,
  ci.topic,
  ci.message,
  coalesce(l.status, 'new') AS status,
  l.assigned_to,
  au.full_name AS assignee_name,
  au.email AS assignee_email,
  l.enrollment_id,
  l.converted_at::text AS converted_at,
  l.channel::text AS channel,
  l.meta,
  ci.created_at::text AS created_at,
  l.updated_at::text AS updated_at
`;

async function recordHistory(input: {
  inquiry_id: string;
  lead_id: string | null;
  actor_id: string | null;
  action: string;
  from_value?: string | null;
  to_value?: string | null;
  meta?: Record<string, unknown>;
}) {
  await db.query(
    `INSERT INTO ${INQUIRY_HISTORY_TABLE}
       (inquiry_id, lead_id, actor_id, action, from_value, to_value, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [
      input.inquiry_id,
      input.lead_id,
      input.actor_id,
      input.action,
      input.from_value ?? null,
      input.to_value ?? null,
      JSON.stringify(input.meta ?? {}),
    ],
  );
}

export async function listContactInquiries(opts: {
  status?: string;
  assigned_to?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (opts.status) {
    where.push(`COALESCE(l.status, 'new') = $${i++}`);
    params.push(opts.status);
  }
  if (opts.assigned_to === "unassigned") {
    where.push(`l.assigned_to IS NULL`);
  } else if (opts.assigned_to) {
    where.push(`l.assigned_to = $${i++}`);
    params.push(opts.assigned_to);
  }
  if (opts.search?.trim()) {
    where.push(
      `(ci.first_name ILIKE $${i} OR ci.last_name ILIKE $${i} OR ci.email ILIKE $${i} OR ci.phone ILIKE $${i} OR ci.topic ILIKE $${i} OR ci.message ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${CONTACT_INQUIRIES_TABLE} ci
     LEFT JOIN ${LEADS_TABLE} l ON l.id = ci.lead_id
     ${whereSql}`,
    params,
  );
  const total = parseInt(
    Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
    10,
  );

  const [rows] = await db.query<ContactInquiryRow>(
    `SELECT ${LIST_SELECT}
     FROM ${CONTACT_INQUIRIES_TABLE} ci
     LEFT JOIN ${LEADS_TABLE} l ON l.id = ci.lead_id
     LEFT JOIN ${USERS_TABLE} au ON au.id = l.assigned_to
     ${whereSql}
     ORDER BY ci.created_at DESC
     LIMIT $${i++} OFFSET $${i}`,
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

export async function getContactInquiryById(id: string) {
  const [rows] = await db.query<ContactInquiryRow>(
    `SELECT ${LIST_SELECT}
     FROM ${CONTACT_INQUIRIES_TABLE} ci
     LEFT JOIN ${LEADS_TABLE} l ON l.id = ci.lead_id
     LEFT JOIN ${USERS_TABLE} au ON au.id = l.assigned_to
     WHERE ci.id = $1`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getInquiryDetail(id: string) {
  const inquiry = await getContactInquiryById(id);
  if (!inquiry) return null;

  const [comments] = await db.query(
    `SELECT c.id, c.body, c.created_at::text AS created_at,
            c.author_id, u.full_name AS author_name, u.email AS author_email
     FROM ${INQUIRY_COMMENTS_TABLE} c
     LEFT JOIN ${USERS_TABLE} u ON u.id = c.author_id
     WHERE c.inquiry_id = $1
     ORDER BY c.created_at ASC`,
    [id],
  );

  const [history] = await db.query(
    `SELECT h.id, h.action, h.from_value, h.to_value, h.meta,
            h.created_at::text AS created_at, h.actor_id,
            u.full_name AS actor_name
     FROM ${INQUIRY_HISTORY_TABLE} h
     LEFT JOIN ${USERS_TABLE} u ON u.id = h.actor_id
     WHERE h.inquiry_id = $1
     ORDER BY h.created_at DESC`,
    [id],
  );

  const meta = (inquiry.meta ?? {}) as Record<string, unknown>;
  let program_title: string | null = null;
  let program_type: "course" | "workshop" | null = null;
  let course_id: string | null =
    typeof meta.course_id === "string" ? meta.course_id : null;
  let workshop_id: string | null =
    typeof meta.workshop_id === "string" ? meta.workshop_id : null;

  let application: Record<string, unknown> | null = null;
  if (inquiry.lead_id) {
    const [appRows] = await db.query(
      `SELECT a.*,
              c.title AS course_title,
              w.title AS workshop_title
       FROM ${ENROLLMENT_APPLICATIONS_TABLE} a
       LEFT JOIN ${COURSES_TABLE} c ON c.id = a.course_id
       LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = a.workshop_id
       WHERE a.lead_id = $1
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [inquiry.lead_id],
    );
    application = Array.isArray(appRows)
      ? ((appRows[0] as Record<string, unknown>) ?? null)
      : null;
  }

  if (application) {
    if (application.workshop_id) {
      workshop_id = String(application.workshop_id);
      course_id = null;
      program_title =
        (application.workshop_title as string) ||
        (application.course_preference as string) ||
        null;
      program_type = "workshop";
    } else if (application.course_id) {
      course_id = String(application.course_id);
      workshop_id = null;
      program_title =
        (application.course_title as string) ||
        (application.course_preference as string) ||
        null;
      program_type = "course";
    }
  } else if (workshop_id) {
    course_id = null;
    const [w] = await db.query<{ title: string }>(
      `SELECT title FROM ${WORKSHOPS_TABLE} WHERE id = $1`,
      [workshop_id],
    );
    program_title = Array.isArray(w) ? w[0]?.title ?? null : null;
    program_type = "workshop";
  } else if (course_id) {
    const [c] = await db.query<{ title: string }>(
      `SELECT title FROM ${COURSES_TABLE} WHERE id = $1`,
      [course_id],
    );
    program_title = Array.isArray(c) ? c[0]?.title ?? null : null;
    program_type = "course";
  } else if (inquiry.topic?.startsWith("Workshop:")) {
    program_title = inquiry.topic.replace(/^Workshop:\s*/, "");
    program_type = "workshop";
  } else if (inquiry.topic?.startsWith("Course:")) {
    program_title = inquiry.topic.replace(/^Course:\s*/, "");
    program_type = "course";
  }

  return {
    ...inquiry,
    program_title,
    program_type,
    course_id,
    workshop_id,
    application,
    comments: Array.isArray(comments) ? comments : [],
    history: Array.isArray(history) ? history : [],
  };
}

export async function updateInquiryStatus(
  id: string,
  status: EnquiryStatus,
  actorId: string | null,
) {
  const inquiry = await getContactInquiryById(id);
  if (!inquiry) return null;
  if (!inquiry.lead_id) {
    throw Object.assign(new Error("Inquiry has no linked lead"), {
      status: 422,
    });
  }
  if (inquiry.status === "converted" && status !== "converted") {
    throw Object.assign(new Error("Converted enquiries cannot change status"), {
      status: 422,
    });
  }
  if (status === "converted") {
    throw Object.assign(
      new Error('Use "Convert after payment" to mark as converted'),
      { status: 422 },
    );
  }

  const prev = inquiry.status;
  await db.query(
    `UPDATE ${LEADS_TABLE}
     SET status = $1, updated_at = now()
     WHERE id = $2`,
    [status, inquiry.lead_id],
  );

  await recordHistory({
    inquiry_id: id,
    lead_id: inquiry.lead_id,
    actor_id: actorId,
    action: "status_changed",
    from_value: prev,
    to_value: status,
  });

  return getInquiryDetail(id);
}

export async function assignInquiry(
  id: string,
  assignedTo: string | null,
  actorId: string | null,
) {
  const inquiry = await getContactInquiryById(id);
  if (!inquiry) return null;
  if (!inquiry.lead_id) {
    throw Object.assign(new Error("Inquiry has no linked lead"), {
      status: 422,
    });
  }

  if (assignedTo) {
    const [staff] = await db.query<{ id: string }>(
      `SELECT id FROM ${USERS_TABLE}
       WHERE id = $1 AND role IN ('admin', 'staff') AND deleted_at IS NULL`,
      [assignedTo],
    );
    if (!Array.isArray(staff) || !staff[0]) {
      throw Object.assign(new Error("Assignee must be admin or staff"), {
        status: 422,
      });
    }
  }

  const prev = inquiry.assigned_to;
  await db.query(
    `UPDATE ${LEADS_TABLE}
     SET assigned_to = $1, updated_at = now()
     WHERE id = $2`,
    [assignedTo, inquiry.lead_id],
  );

  await recordHistory({
    inquiry_id: id,
    lead_id: inquiry.lead_id,
    actor_id: actorId,
    action: "assigned",
    from_value: prev,
    to_value: assignedTo,
  });

  return getInquiryDetail(id);
}

export async function addInquiryComment(
  id: string,
  body: string,
  actorId: string,
) {
  const inquiry = await getContactInquiryById(id);
  if (!inquiry) {
    throw Object.assign(new Error("Enquiry not found"), { status: 404 });
  }
  const text = body.trim();
  if (!text) {
    throw Object.assign(new Error("Comment is required"), { status: 400 });
  }

  const [rows] = await db.query(
    `INSERT INTO ${INQUIRY_COMMENTS_TABLE}
       (inquiry_id, lead_id, author_id, body)
     VALUES ($1,$2,$3,$4)
     RETURNING id, body, created_at::text AS created_at, author_id`,
    [id, inquiry.lead_id, actorId, text],
  );

  await recordHistory({
    inquiry_id: id,
    lead_id: inquiry.lead_id,
    actor_id: actorId,
    action: "comment_added",
    to_value: text.slice(0, 120),
  });

  return Array.isArray(rows) ? rows[0] : null;
}

async function ensureStudentFromEnquiry(input: {
  full_name: string;
  email: string;
  phone: string | null;
}): Promise<string> {
  const email = input.email.toLowerCase().trim();
  const [existing] = await db.query<{ id: string }>(
    `SELECT id FROM ${USERS_TABLE}
     WHERE lower(email) = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  let userId = Array.isArray(existing) ? existing[0]?.id ?? null : null;

  if (!userId) {
    const tempPassword = bcrypt.hashSync(`SA-${Date.now().toString(36)}`, 10);
    const [userRows] = await db.query<{ id: string }>(
      `INSERT INTO ${USERS_TABLE} (email, full_name, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'student', true)
       RETURNING id`,
      [email, input.full_name, tempPassword],
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
      [input.full_name, userId],
    );
  }

  if (!userId) {
    throw Object.assign(new Error("Failed to create student"), { status: 500 });
  }

  await db.query(
    `INSERT INTO ${STUDENT_PROFILES_TABLE} (user_id, phone, whatsapp)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       phone = COALESCE(EXCLUDED.phone, ${STUDENT_PROFILES_TABLE}.phone),
       whatsapp = COALESCE(EXCLUDED.whatsapp, ${STUDENT_PROFILES_TABLE}.whatsapp),
       updated_at = now()`,
    [userId, input.phone, input.phone],
  );

  return userId;
}

/**
 * Convert enquiry after QR payment confirmed → student + enrollment.
 */
export async function convertInquiryToEnrollment(
  inquiryId: string,
  actorId: string,
  input: {
    payment_type: "advance" | "full";
    course_id?: string | null;
    workshop_id?: string | null;
    agreed_price?: number | null;
    amount_paid?: number | null;
    currency?: string;
  },
) {
  const inquiry = await getContactInquiryById(inquiryId);
  if (!inquiry) {
    throw Object.assign(new Error("Enquiry not found"), { status: 404 });
  }
  if (!inquiry.lead_id) {
    throw Object.assign(new Error("Inquiry has no linked lead"), {
      status: 422,
    });
  }
  if (inquiry.status === "converted" || inquiry.enrollment_id) {
    throw Object.assign(new Error("Enquiry already converted"), {
      status: 422,
    });
  }
  if (!inquiry.email?.trim()) {
    throw Object.assign(new Error("Enquiry needs an email to convert"), {
      status: 422,
    });
  }

  // Explicit request wins (exclusive). Do not merge with meta via || —
  // that incorrectly pairs a selected course with a leftover workshop_id.
  let courseId: string | null = input.course_id || null;
  let workshopId: string | null = input.workshop_id || null;

  if (courseId && workshopId) {
    // Prefer the field the admin filled; if both somehow set, keep course.
    workshopId = null;
  }

  if (!courseId && !workshopId) {
    if (inquiry.lead_id) {
      const [appRows] = await db.query<{
        course_id: string | null;
        workshop_id: string | null;
      }>(
        `SELECT course_id, workshop_id FROM ${ENROLLMENT_APPLICATIONS_TABLE}
         WHERE lead_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [inquiry.lead_id],
      );
      const app = Array.isArray(appRows) ? appRows[0] : null;
      if (app?.workshop_id) {
        workshopId = app.workshop_id;
      } else if (app?.course_id) {
        courseId = app.course_id;
      }
    }
  }

  if (!courseId && !workshopId) {
    const meta = (inquiry.meta ?? {}) as Record<string, unknown>;
    if (typeof meta.workshop_id === "string") {
      workshopId = meta.workshop_id;
    } else if (typeof meta.course_id === "string") {
      courseId = meta.course_id;
    }
  }

  if (!courseId && !workshopId) {
    throw Object.assign(
      new Error("Select a course or workshop before converting"),
      { status: 422 },
    );
  }

  let title = inquiry.topic || "Enrollment";
  let listPrice: number | null = null;
  let currency = input.currency || "INR";

  if (workshopId) {
    const [rows] = await db.query<{
      title: string;
      price: number | null;
      currency: string;
    }>(
      `SELECT title, price, currency FROM ${WORKSHOPS_TABLE}
       WHERE id = $1 AND deleted_at IS NULL`,
      [workshopId],
    );
    const w = Array.isArray(rows) ? rows[0] : null;
    if (!w) {
      throw Object.assign(new Error("Workshop not found"), { status: 404 });
    }
    title = w.title;
    listPrice = w.price != null ? Number(w.price) : null;
    currency = w.currency || currency;
  } else if (courseId) {
    const [rows] = await db.query<{
      title: string;
      list_price: number | null;
      currency: string;
    }>(
      `SELECT title, list_price, currency FROM ${COURSES_TABLE}
       WHERE id = $1 AND deleted_at IS NULL`,
      [courseId],
    );
    const c = Array.isArray(rows) ? rows[0] : null;
    if (!c) {
      throw Object.assign(new Error("Course not found"), { status: 404 });
    }
    title = c.title;
    listPrice = c.list_price != null ? Number(c.list_price) : null;
    currency = c.currency || currency;
  }

  const agreedPrice =
    input.agreed_price ?? listPrice ?? input.amount_paid ?? null;
  const amountPaid =
    input.amount_paid != null
      ? input.amount_paid
      : input.payment_type === "full"
        ? agreedPrice
        : null;

  if (
    input.payment_type === "advance" &&
    (amountPaid == null || amountPaid <= 0)
  ) {
    throw Object.assign(
      new Error("Enter the advance amount paid before converting"),
      { status: 422 },
    );
  }

  const userId = await ensureStudentFromEnquiry({
    full_name: inquiry.full_name || "Student",
    email: inquiry.email,
    phone: inquiry.phone,
  });

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
       FROM ${COURSE_TREATMENTS_TABLE}
       WHERE course_id = $1 ORDER BY sort_order`,
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
    workshop_id: workshopId,
    title,
    origin: "catalog",
    status: "active",
    currency,
    agreed_price: agreedPrice,
    payment_type: input.payment_type,
    treatments,
    notes_internal: `Converted from enquiry ${inquiryId} · payment ${input.payment_type}`,
  });

  const enrollmentId = (enrollment as { id?: string } | null)?.id;
  if (!enrollmentId) {
    throw Object.assign(new Error("Failed to create enrollment"), {
      status: 500,
    });
  }

  if (amountPaid != null && amountPaid > 0) {
    const txn = `TXN-${Date.now().toString(36).toUpperCase()}`;
    await db.query(
      `INSERT INTO ${PAYMENTS_TABLE}
         (txn_code, user_id, enrollment_id, course_id, amount, currency, method,
          status, payment_option, description, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,'other','paid',$7,$8,now())`,
      [
        txn,
        userId,
        enrollmentId,
        courseId,
        amountPaid,
        currency,
        input.payment_type === "advance" ? "deposit" : "full",
        `${title} · ${input.payment_type} (QR)`,
      ],
    );
  }

  if (workshopId) {
    await db.query(
      `UPDATE ${WORKSHOPS_TABLE}
       SET seats_left = GREATEST(COALESCE(seats_left, 0) - 1, 0),
           updated_at = now()
       WHERE id = $1 AND seats_left IS NOT NULL`,
      [workshopId],
    );
  }

  await db.query(
    `UPDATE ${LEADS_TABLE}
     SET status = 'converted',
         enrollment_id = $1,
         converted_at = now(),
         updated_at = now()
     WHERE id = $2`,
    [enrollmentId, inquiry.lead_id],
  );

  await db.query(
    `UPDATE ${ENROLLMENT_APPLICATIONS_TABLE}
     SET status = 'enrolled', user_id = $1, updated_at = now()
     WHERE lead_id = $2 AND status IN ('submitted', 'under_review', 'approved')`,
    [userId, inquiry.lead_id],
  );

  await recordHistory({
    inquiry_id: inquiryId,
    lead_id: inquiry.lead_id,
    actor_id: actorId,
    action: "converted",
    from_value: inquiry.status,
    to_value: "converted",
    meta: {
      enrollment_id: enrollmentId,
      payment_type: input.payment_type,
      course_id: courseId,
      workshop_id: workshopId,
      amount_paid: amountPaid,
    },
  });

  return {
    enrollment,
    inquiry: await getInquiryDetail(inquiryId),
  };
}
