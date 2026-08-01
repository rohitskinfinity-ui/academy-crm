import { db } from "@/lib/db";
import { CALENDAR_EVENTS_TABLE } from "@/lib/db/schema";

export async function listPublicEvents(opts: {
  type?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = [
    "e.deleted_at IS NULL",
    "e.is_published = true",
    "e.status <> 'cancelled'",
  ];
  const params: unknown[] = [];
  let i = 1;

  if (opts.type) {
    where.push(`e.type = $${i++}`);
    params.push(opts.type);
  }
  if (opts.from) {
    where.push(`e.starts_at >= $${i++}`);
    params.push(opts.from);
  }
  if (opts.to) {
    where.push(`e.starts_at <= $${i++}`);
    params.push(opts.to);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${CALENDAR_EVENTS_TABLE} e ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT
       e.id, e.type, e.slug, e.title, e.description, e.category_label,
       e.starts_at, e.ends_at, e.duration_label, e.location, e.venue,
       e.seats_total, e.seats_left, e.price, e.currency, e.image_url,
       e.course_id, e.status
     FROM ${CALENDAR_EVENTS_TABLE} e
     ${whereSql}
     ORDER BY e.starts_at ASC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  return {
    items: Array.isArray(rows) ? rows : [],
    meta: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}
