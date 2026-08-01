import { db } from "@/lib/db";
import {
  BLOG_CATEGORIES_TABLE,
  BLOG_POSTS_TABLE,
} from "@/lib/db/schema";

export async function listBlogCategories() {
  const [rows] = await db.query(
    `SELECT id, slug, name, created_at::text
     FROM ${BLOG_CATEGORIES_TABLE}
     ORDER BY name`,
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createBlogCategory(input: {
  name: string;
  slug: string;
}) {
  try {
    const [rows] = await db.query(
      `INSERT INTO ${BLOG_CATEGORIES_TABLE} (name, slug)
       VALUES ($1, $2)
       RETURNING id, slug, name, created_at::text`,
      [input.name, input.slug],
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Category slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function listBlogPosts(opts: {
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = ["p.deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.status) {
    where.push(`p.status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.search?.trim()) {
    where.push(
      `(p.title ILIKE $${i} OR p.slug ILIKE $${i} OR p.author_name ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${BLOG_POSTS_TABLE} p ${whereSql}`,
    params,
  );
  const total = parseInt(
    Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0",
    10,
  );

  const [rows] = await db.query(
    `SELECT
       p.id, p.slug, p.title, p.excerpt, p.image_url, p.author_name,
       p.read_time_minutes, p.status, p.published_at::text, p.created_at::text,
       p.updated_at::text, p.category_id,
       c.name AS category_name, c.slug AS category_slug
     FROM ${BLOG_POSTS_TABLE} p
     LEFT JOIN ${BLOG_CATEGORIES_TABLE} c ON c.id = p.category_id
     ${whereSql}
     ORDER BY p.updated_at DESC
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

export async function getBlogPostById(id: string) {
  const [rows] = await db.query(
    `SELECT
       p.id, p.slug, p.title, p.excerpt, p.body, p.image_url, p.author_name,
       p.read_time_minutes, p.status, p.published_at::text,
       p.seo_title, p.seo_description, p.category_id,
       p.created_at::text, p.updated_at::text,
       c.name AS category_name, c.slug AS category_slug
     FROM ${BLOG_POSTS_TABLE} p
     LEFT JOIN ${BLOG_CATEGORIES_TABLE} c ON c.id = p.category_id
     WHERE p.id = $1 AND p.deleted_at IS NULL`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function createBlogPost(input: {
  title: string;
  slug: string;
  excerpt?: string | null;
  body?: string | null;
  image_url?: string | null;
  author_name?: string | null;
  category_id?: string | null;
  read_time_minutes?: number | null;
  status?: string;
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
}) {
  const status = input.status ?? "draft";
  const publishedAt =
    input.published_at ??
    (status === "published" ? new Date().toISOString() : null);

  try {
    const [rows] = await db.query(
      `INSERT INTO ${BLOG_POSTS_TABLE}
         (title, slug, excerpt, body, image_url, author_name, category_id,
          read_time_minutes, status, published_at, seo_title, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        input.title,
        input.slug,
        input.excerpt ?? null,
        input.body ?? null,
        input.image_url ?? null,
        input.author_name ?? null,
        input.category_id ?? null,
        input.read_time_minutes ?? null,
        status,
        publishedAt,
        input.seo_title ?? null,
        input.seo_description ?? null,
      ],
    );
    const id = Array.isArray(rows) ? rows[0]?.id : null;
    if (!id) throw new Error("Failed to create blog post");
    return getBlogPostById(id);
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Blog slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function updateBlogPost(
  id: string,
  patch: Record<string, unknown>,
) {
  const existing = await getBlogPostById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const allowed = [
    "title",
    "slug",
    "excerpt",
    "body",
    "image_url",
    "author_name",
    "category_id",
    "read_time_minutes",
    "status",
    "published_at",
    "seo_title",
    "seo_description",
  ] as const;

  for (const key of allowed) {
    if (patch[key] === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(patch[key]);
  }

  if (
    patch.status === "published" &&
    patch.published_at === undefined &&
    !(existing as { published_at?: string | null }).published_at
  ) {
    fields.push(`published_at = $${i++}`);
    params.push(new Date().toISOString());
  }

  if (!fields.length) return existing;

  fields.push("updated_at = now()");
  params.push(id);

  try {
    await db.query(
      `UPDATE ${BLOG_POSTS_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL`,
      params,
    );
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Blog slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }

  return getBlogPostById(id);
}

export async function softDeleteBlogPost(id: string) {
  const [rows] = await db.query(
    `UPDATE ${BLOG_POSTS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
