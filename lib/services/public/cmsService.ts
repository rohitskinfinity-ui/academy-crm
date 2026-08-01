import { db } from "@/lib/db";
import { getGcpSignedUrl } from "@/lib/gcp/storage";
import {
  AFFILIATIONS_TABLE,
  ANNOUNCEMENTS_TABLE,
  BLOG_CATEGORIES_TABLE,
  BLOG_POSTS_TABLE,
  FAQS_TABLE,
  HERO_BANNERS_TABLE,
  INSTITUTIONAL_CERTIFICATES_TABLE,
  LEADERSHIP_TABLE,
  MILESTONES_TABLE,
  PARTNERS_TABLE,
  PILLARS_TABLE,
  SITE_STATS_TABLE,
  TESTIMONIALS_TABLE,
} from "@/lib/db/schema";

export async function getPublicSiteChrome() {
  const [
    [announcements],
    [heroBanners],
    [partners],
    [faqs],
    [siteStats],
  ] = await Promise.all([
    db.query(
      `SELECT id, message, href, sort_order
       FROM ${ANNOUNCEMENTS_TABLE}
       WHERE is_active = true
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at >= now())
       ORDER BY sort_order, created_at`,
    ),
    db.query(
      `SELECT id, image_url, eyebrow, title, subtitle, cta_label, cta_href, sort_order
       FROM ${HERO_BANNERS_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, created_at`,
    ),
    db.query(
      `SELECT id, name, icon, logo_url, sort_order
       FROM ${PARTNERS_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, name`,
    ),
    db.query(
      `SELECT id, icon, question, answer, sort_order
       FROM ${FAQS_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, created_at`,
    ),
    db.query(
      `SELECT id, icon, value_label, suffix, label, hint, sort_order, location
       FROM ${SITE_STATS_TABLE}
       ORDER BY sort_order, created_at`,
    ),
  ]);

  return {
    announcements: Array.isArray(announcements) ? announcements : [],
    hero_banners: Array.isArray(heroBanners) ? heroBanners : [],
    partners: Array.isArray(partners) ? partners : [],
    faqs: Array.isArray(faqs) ? faqs : [],
    site_stats: Array.isArray(siteStats) ? siteStats : [],
  };
}

export async function getPublicAbout() {
  const [
    [leadership],
    [milestones],
    [pillars],
    [affiliations],
    [certificates],
    [siteStats],
  ] = await Promise.all([
    db.query(
      `SELECT id, name, role, bio, image_url, sort_order
       FROM ${LEADERSHIP_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, name`,
    ),
    db.query(
      `SELECT id, year_label, title, description, sort_order
       FROM ${MILESTONES_TABLE}
       ORDER BY sort_order, year_label`,
    ),
    db.query(
      `SELECT id, icon, label, title, description, sort_order, kind
       FROM ${PILLARS_TABLE}
       ORDER BY sort_order, created_at`,
    ),
    db.query(
      `SELECT id, name, description, logo_url, color_token, sort_order
       FROM ${AFFILIATIONS_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, name`,
    ),
    db.query(
      `SELECT id, code, badge, title, subtitle, description, view_url, logo_url, color_token, sort_order
       FROM ${INSTITUTIONAL_CERTIFICATES_TABLE}
       WHERE is_published = true
       ORDER BY sort_order, title`,
    ),
    db.query(
      `SELECT id, icon, value_label, suffix, label, hint, sort_order, location
       FROM ${SITE_STATS_TABLE}
       WHERE location IS NULL OR location IN ('about', 'home')
       ORDER BY sort_order`,
    ),
  ]);

  return {
    leadership: Array.isArray(leadership) ? leadership : [],
    milestones: Array.isArray(milestones) ? milestones : [],
    pillars: Array.isArray(pillars) ? pillars : [],
    affiliations: Array.isArray(affiliations) ? affiliations : [],
    institutional_certificates: Array.isArray(certificates)
      ? certificates
      : [],
    site_stats: Array.isArray(siteStats) ? siteStats : [],
  };
}

export async function listPublicBlogPosts(opts: {
  page: number;
  limit: number;
}) {
  const where = `WHERE p.deleted_at IS NULL AND p.status = 'published'`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${BLOG_POSTS_TABLE} p ${where}`,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT
       p.id, p.slug, p.title, p.excerpt, p.image_url, p.author_name,
       p.read_time_minutes, p.published_at, p.seo_title, p.seo_description,
       c.slug AS category_slug, c.name AS category_name
     FROM ${BLOG_POSTS_TABLE} p
     LEFT JOIN ${BLOG_CATEGORIES_TABLE} c ON c.id = p.category_id
     ${where}
     ORDER BY p.published_at DESC NULLS LAST, p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [opts.limit, offset],
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

export async function getPublicBlogPostBySlug(slug: string) {
  const [rows] = await db.query(
    `SELECT
       p.id, p.slug, p.title, p.excerpt, p.body, p.image_url, p.author_name,
       p.read_time_minutes, p.published_at, p.seo_title, p.seo_description,
       c.slug AS category_slug, c.name AS category_name
     FROM ${BLOG_POSTS_TABLE} p
     LEFT JOIN ${BLOG_CATEGORIES_TABLE} c ON c.id = p.category_id
     WHERE p.slug = $1 AND p.deleted_at IS NULL AND p.status = 'published'`,
    [slug],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function listPublicTestimonials(opts: {
  type?: string;
  featured?: boolean;
  page: number;
  limit: number;
}) {
  const where: string[] = [
    "t.deleted_at IS NULL",
    "t.status = 'published'",
  ];
  const params: unknown[] = [];
  let i = 1;

  if (opts.type) {
    where.push(`t.type = $${i++}`);
    params.push(opts.type);
  }
  if (opts.featured === true) {
    where.push(`t.is_featured = true`);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TESTIMONIALS_TABLE} t ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT
       t.id, t.type, t.person_name, t.credentials, t.role, t.company, t.location,
       t.course_label, t.rating, t.quote, t.image_url, t.thumbnail_url,
       t.video_url, t.video_duration, t.video_title, t.is_featured,
       t.sort_order, t.published_at, t.review_date
     FROM ${TESTIMONIALS_TABLE} t
     ${whereSql}
     ORDER BY t.is_featured DESC, t.sort_order, t.published_at DESC NULLS LAST
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, opts.limit, offset],
  );

  const items = Array.isArray(rows) ? rows : [];
  const signed = await Promise.all(
    items.map(async (row) => {
      const r = row as Record<string, unknown>;
      return {
        ...r,
        image_url: r.image_url
          ? await getGcpSignedUrl(String(r.image_url), 120)
          : null,
        thumbnail_url: r.thumbnail_url
          ? await getGcpSignedUrl(String(r.thumbnail_url), 120)
          : null,
        video_url: r.video_url
          ? await getGcpSignedUrl(String(r.video_url), 120)
          : null,
      };
    }),
  );

  return {
    items: signed,
    meta: {
      page: opts.page,
      limit: opts.limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / opts.limit)),
    },
  };
}

/**
 * Homepage reviews — published written testimonials marked featured.
 * Falls back to latest published written reviews if none are featured.
 */
export async function listPublicHomeReviews(opts: { limit: number }) {
  const featured = await listPublicTestimonials({
    type: "text",
    featured: true,
    page: 1,
    limit: opts.limit,
  });

  if (featured.items.length > 0) {
    return {
      items: featured.items.map(toHomeReview),
      meta: { limit: opts.limit, total: featured.items.length },
    };
  }

  const latest = await listPublicTestimonials({
    type: "text",
    page: 1,
    limit: opts.limit,
  });

  return {
    items: latest.items.map(toHomeReview),
    meta: { limit: opts.limit, total: latest.items.length },
  };
}

function toHomeReview(row: Record<string, unknown>) {
  return {
    id: row.id,
    person_name: row.person_name,
    credentials: row.credentials ?? null,
    location: row.location ?? null,
    course_label: row.course_label ?? null,
    rating: row.rating ?? null,
    quote: row.quote,
    image_url: row.image_url ?? null,
    is_featured: Boolean(row.is_featured),
    review_date: row.review_date ?? null,
  };
}
