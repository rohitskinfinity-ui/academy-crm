import { db, withTransaction } from "@/lib/db";
import {
  CALLBACK_REQUESTS_TABLE,
  CONTACT_INQUIRIES_TABLE,
  LEADS_TABLE,
  NEWSLETTER_SUBSCRIBERS_TABLE,
} from "@/lib/db/schema";

export async function submitContact(input: {
  first_name: string;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  topic?: string | null;
  message: string;
}) {
  const fullName = [input.first_name, input.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return withTransaction(async (conn) => {
    const [leadRows] = await conn.query<{ id: string }>(
      `INSERT INTO ${LEADS_TABLE}
         (channel, full_name, email, phone, message, meta, status)
       VALUES ('contact', $1, $2, $3, $4, $5::jsonb, 'new')
       RETURNING id`,
      [
        fullName,
        input.email.toLowerCase(),
        input.phone ?? null,
        input.message,
        JSON.stringify({ topic: input.topic ?? null }),
      ],
    );
    const leadId = Array.isArray(leadRows) ? leadRows[0]?.id : undefined;
    if (!leadId) throw new Error("Failed to create lead");

    const [inquiryRows] = await conn.query<{ id: string; created_at: string }>(
      `INSERT INTO ${CONTACT_INQUIRIES_TABLE}
         (lead_id, first_name, last_name, email, phone, topic, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, created_at`,
      [
        leadId,
        input.first_name,
        input.last_name ?? null,
        input.email.toLowerCase(),
        input.phone ?? null,
        input.topic ?? null,
        input.message,
      ],
    );
    return Array.isArray(inquiryRows) ? inquiryRows[0] : null;
  });
}

export async function subscribeNewsletter(email: string) {
  const normalized = email.toLowerCase().trim();
  const [rows] = await db.query(
    `INSERT INTO ${NEWSLETTER_SUBSCRIBERS_TABLE} (email, subscribed_at, unsubscribed_at)
     VALUES ($1, now(), NULL)
     ON CONFLICT (email) DO UPDATE SET
       subscribed_at = now(),
       unsubscribed_at = NULL
     RETURNING id, email, subscribed_at`,
    [normalized],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function submitCallback(input: {
  full_name: string;
  email?: string | null;
  phone: string;
  item_title?: string | null;
  item_category?: string | null;
  preferred_time?: string | null;
}) {
  return withTransaction(async (conn) => {
    const [leadRows] = await conn.query<{ id: string }>(
      `INSERT INTO ${LEADS_TABLE}
         (channel, full_name, email, phone, message, meta, status)
       VALUES ('callback', $1, $2, $3, $4, $5::jsonb, 'new')
       RETURNING id`,
      [
        input.full_name,
        input.email?.toLowerCase() ?? null,
        input.phone,
        input.item_title ?? null,
        JSON.stringify({
          item_category: input.item_category ?? null,
          preferred_time: input.preferred_time ?? null,
        }),
      ],
    );
    const leadId = Array.isArray(leadRows) ? leadRows[0]?.id : undefined;
    if (!leadId) throw new Error("Failed to create lead");

    const [cbRows] = await conn.query<{
      id: string;
      status: string;
      created_at: string;
    }>(
      `INSERT INTO ${CALLBACK_REQUESTS_TABLE}
         (lead_id, full_name, email, phone, item_title, item_category, preferred_time, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'open')
       RETURNING id, status, created_at`,
      [
        leadId,
        input.full_name,
        input.email?.toLowerCase() ?? null,
        input.phone,
        input.item_title ?? null,
        input.item_category ?? null,
        input.preferred_time ?? null,
      ],
    );
    return Array.isArray(cbRows) ? cbRows[0] : null;
  });
}
