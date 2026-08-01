import { db } from "@/lib/db";
import { COURSES_TABLE, USERS_TABLE } from "@/lib/db/schema";

export type CalendarCourseStatus = "upcoming" | "ongoing";

function todayInTimeZone(timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type Row = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  list_price: string | number | null;
  currency: string;
  duration_label: string | null;
  level: string | null;
  mode: string | null;
  tag: string | null;
  instructor_name: string | null;
  starts_on: string;
  ends_on: string | null;
  status: CalendarCourseStatus;
};

/**
 * Public calendar: published courses with starts_on set,
 * classified as upcoming or ongoing from the course date window.
 */
export async function listPublicCalendarCourses(opts: {
  status?: "upcoming" | "ongoing" | "all";
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}) {
  const today = todayInTimeZone();
  const statusFilter = opts.status || "all";
  const params: unknown[] = [today];
  let i = 2;

  const filters: string[] = [
    "c.status = 'published'",
    "c.deleted_at IS NULL",
    "c.starts_on IS NOT NULL",
    // exclude past: end before today (if no end, still show after start)
    `(c.ends_on IS NULL OR c.ends_on >= $1::date)`,
  ];

  if (statusFilter === "upcoming") {
    filters.push(`c.starts_on > $1::date`);
  } else if (statusFilter === "ongoing") {
    filters.push(`c.starts_on <= $1::date`);
    filters.push(`(c.ends_on IS NULL OR c.ends_on >= $1::date)`);
  } else {
    // all = upcoming + ongoing (already excluded past via ends_on)
  }

  if (opts.search?.trim()) {
    filters.push(
      `(c.title ILIKE $${i} OR COALESCE(c.tag, '') ILIKE $${i} OR COALESCE(c.duration_label, '') ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }
  if (opts.from) {
    filters.push(`c.starts_on >= $${i++}::date`);
    params.push(opts.from.slice(0, 10));
  }
  if (opts.to) {
    filters.push(`c.starts_on <= $${i++}::date`);
    params.push(opts.to.slice(0, 10));
  }

  const whereSql = `WHERE ${filters.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${COURSES_TABLE} c
     ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query<Row>(
    `SELECT
       c.id, c.slug, c.title, c.image_url, c.list_price, c.currency,
       c.duration_label, c.level, c.mode, c.tag,
       u.full_name AS instructor_name,
       c.starts_on::text AS starts_on,
       c.ends_on::text AS ends_on,
       CASE
         WHEN c.starts_on <= $1::date
          AND (c.ends_on IS NULL OR c.ends_on >= $1::date)
         THEN 'ongoing'
         ELSE 'upcoming'
       END AS status
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${USERS_TABLE} u ON u.id = c.faculty_lead_id
     ${whereSql}
     ORDER BY
       CASE
         WHEN c.starts_on <= $1::date
          AND (c.ends_on IS NULL OR c.ends_on >= $1::date)
         THEN 0 ELSE 1
       END,
       c.starts_on ASC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  const items = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    // Compat aliases for existing calendar UI
    starts_at: row.starts_on,
    ends_at: row.ends_on,
    duration_label: row.duration_label,
    image_url: row.image_url,
    list_price: row.list_price,
    currency: row.currency || "INR",
    level: row.level,
    mode: row.mode,
    tag: row.tag,
    category_label: row.tag || row.level || row.mode,
    location: row.mode === "online" ? "Online" : null,
    venue: null,
    seats_total: null,
    seats_left: null,
    instructor_name: row.instructor_name,
    next_event_title: row.duration_label,
  }));

  return {
    items,
    meta: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}
