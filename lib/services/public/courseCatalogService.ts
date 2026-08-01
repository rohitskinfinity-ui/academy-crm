import { db } from "@/lib/db";
import {
  CAMPUSES_TABLE,
  COURSE_CATEGORIES_TABLE,
  COURSE_FAQS_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  TESTIMONIALS_TABLE,
  TREATMENT_STAGES_TABLE,
  TREATMENTS_TABLE,
} from "@/lib/db/schema";

const COURSE_CARD_COLUMNS = `
  c.id, c.slug, c.title, c.description, c.image_url, c.duration_label,
  c.mode, c.level, c.certificate_label, c.list_price, c.currency, c.rating,
  c.tag, c.is_bestseller, c.programme_meta, c.eligible_qualifications,
  c.marketing_content, c.seo_title, c.seo_description, c.published_at,
  to_char(c.starts_on, 'YYYY-MM-DD') AS starts_on,
  to_char(c.ends_on, 'YYYY-MM-DD') AS ends_on,
  cat.id AS category_id, cat.slug AS category_slug, cat.title AS category_title
`;

export async function listPublicCategories() {
  const [rows] = await db.query(
    `SELECT id, slug, title, icon, sort_order
     FROM ${COURSE_CATEGORIES_TABLE}
     ORDER BY sort_order, title`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listPublicCampuses() {
  const [rows] = await db.query(
    `SELECT id, name, city, address
     FROM ${CAMPUSES_TABLE}
     WHERE is_active = true
     ORDER BY name`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function listPublicCourses(opts: {
  category?: string;
  level?: string;
  q?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = [
    "c.deleted_at IS NULL",
    "c.status = 'published'",
  ];
  const params: unknown[] = [];
  let i = 1;

  if (opts.category?.trim()) {
    where.push(`cat.slug = $${i++}`);
    params.push(opts.category.trim());
  }
  if (opts.level) {
    where.push(`c.level = $${i++}`);
    params.push(opts.level);
  }
  const search = (opts.q ?? opts.search)?.trim();
  if (search) {
    where.push(
      `(c.title ILIKE $${i} OR c.slug ILIKE $${i} OR c.description ILIKE $${i})`,
    );
    params.push(`%${search}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${COURSE_CATEGORIES_TABLE} cat ON cat.id = c.category_id
     ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT ${COURSE_CARD_COLUMNS}
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${COURSE_CATEGORIES_TABLE} cat ON cat.id = c.category_id
     ${whereSql}
     ORDER BY c.is_bestseller DESC, c.published_at DESC NULLS LAST, c.title
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

export async function getPublicCourseBySlug(slug: string) {
  const [rows] = await db.query(
    `SELECT ${COURSE_CARD_COLUMNS}
     FROM ${COURSES_TABLE} c
     LEFT JOIN ${COURSE_CATEGORIES_TABLE} cat ON cat.id = c.category_id
     WHERE c.slug = $1 AND c.deleted_at IS NULL AND c.status = 'published'`,
    [slug],
  );
  const course = Array.isArray(rows) ? rows[0] : null;
  if (!course) return null;

  const courseId = (course as { id: string }).id;

  const [faqs] = await db.query(
    `SELECT id, question, answer, sort_order
     FROM ${COURSE_FAQS_TABLE}
     WHERE course_id = $1
     ORDER BY sort_order, created_at`,
    [courseId],
  );

  const [reviews] = await db.query(
    `SELECT id, person_name, credentials, rating, quote, sort_order, review_date
     FROM ${TESTIMONIALS_TABLE}
     WHERE course_id = $1
       AND deleted_at IS NULL
       AND status = 'published'
     ORDER BY sort_order, published_at DESC NULLS LAST, created_at`,
    [courseId],
  );

  const [modules] = await db.query(
    `SELECT
       ct.sort_order,
       ct.hands_on_default,
       ct.delivery_modes,
       ct.live_sessions_planned,
       t.id AS treatment_id,
       t.slug AS treatment_slug,
       t.name AS treatment_name,
       t.summary AS treatment_summary,
       t.image_url AS treatment_image_url,
       ts.checklist AS theory_checklist
     FROM ${COURSE_TREATMENTS_TABLE} ct
     JOIN ${TREATMENTS_TABLE} t ON t.id = ct.treatment_id
     LEFT JOIN ${TREATMENT_STAGES_TABLE} ts
       ON ts.treatment_id = t.id AND ts.stage = 'theory'
     WHERE ct.course_id = $1
       AND t.deleted_at IS NULL
       AND t.status = 'published'
     ORDER BY ct.sort_order`,
    [courseId],
  );

  return {
    ...course,
    faqs: Array.isArray(faqs) ? faqs : [],
    reviews: Array.isArray(reviews) ? reviews : [],
    modules: Array.isArray(modules)
      ? modules.map((m: Record<string, unknown>) => {
          const rawChecklist = m.theory_checklist;
          const checklist = Array.isArray(rawChecklist)
            ? rawChecklist.filter(
                (item): item is string => typeof item === "string",
              )
            : [];
          return {
            sort_order: m.sort_order,
            hands_on_default: m.hands_on_default,
            delivery_modes: m.delivery_modes,
            live_sessions_planned: m.live_sessions_planned,
            checklist,
            treatment: {
              id: m.treatment_id,
              slug: m.treatment_slug,
              name: m.treatment_name,
              summary: m.treatment_summary,
              image_url: m.treatment_image_url,
            },
          };
        })
      : [],
  };
}
