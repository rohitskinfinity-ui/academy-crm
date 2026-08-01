import { db } from "@/lib/db";
import {
  CONTACT_INQUIRIES_TABLE,
  LEADS_TABLE,
} from "@/lib/db/schema";

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
  created_at: string;
};

export async function listContactInquiries(opts: {
  status?: string;
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
    `SELECT
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
       ci.created_at::text AS created_at
     FROM ${CONTACT_INQUIRIES_TABLE} ci
     LEFT JOIN ${LEADS_TABLE} l ON l.id = ci.lead_id
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
    `SELECT
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
       ci.created_at::text AS created_at
     FROM ${CONTACT_INQUIRIES_TABLE} ci
     LEFT JOIN ${LEADS_TABLE} l ON l.id = ci.lead_id
     WHERE ci.id = $1`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function updateInquiryStatus(
  id: string,
  status: "new" | "contacted" | "closed" | "spam",
) {
  const inquiry = await getContactInquiryById(id);
  if (!inquiry) return null;
  if (!inquiry.lead_id) {
    throw Object.assign(new Error("Inquiry has no linked lead"), {
      status: 422,
    });
  }

  await db.query(
    `UPDATE ${LEADS_TABLE}
     SET status = $1, updated_at = now()
     WHERE id = $2`,
    [status, inquiry.lead_id],
  );

  return getContactInquiryById(id);
}
