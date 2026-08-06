import { db } from "@/lib/db";
import { WORKSHOPS_TABLE } from "@/lib/db/schema";
import type {
  CreateWorkshopInput,
  UpdateWorkshopInput,
} from "@/lib/validations/admin/workshop";

const SELECT_COLS = `
  id, slug, title, tagline, description, eligibility_html, image_url,
  to_char(starts_on, 'YYYY-MM-DD') AS starts_on,
  to_char(ends_on, 'YYYY-MM-DD') AS ends_on,
  duration_label, locations, delivery_modes, features, procedures,
  seats_total, seats_left, price, currency, contact_phone,
  status, is_published, sort_order,
  published_at::text, created_at::text, updated_at::text
`;

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 160);
}

export async function listWorkshops(opts: {
  status?: string;
  search?: string;
  page: number;
  limit: number;
}) {
  const where: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  let i = 1;

  if (opts.status) {
    where.push(`status = $${i++}`);
    params.push(opts.status);
  }
  if (opts.search?.trim()) {
    where.push(
      `(title ILIKE $${i} OR slug ILIKE $${i} OR COALESCE(locations, '') ILIKE $${i} OR COALESCE(tagline, '') ILIKE $${i})`,
    );
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${WORKSHOPS_TABLE} ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${WORKSHOPS_TABLE}
     ${whereSql}
     ORDER BY sort_order ASC, starts_on DESC, created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
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

export async function getWorkshopById(id: string) {
  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${WORKSHOPS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getWorkshopBySlug(slug: string, publishedOnly = false) {
  const where = [
    "slug = $1",
    "deleted_at IS NULL",
    ...(publishedOnly
      ? ["is_published = true", "status = 'published'"]
      : []),
  ];
  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${WORKSHOPS_TABLE}
     WHERE ${where.join(" AND ")}`,
    [slug],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function createWorkshop(input: CreateWorkshopInput) {
  const slug = input.slug?.trim() || slugify(input.title);
  const status = input.status ?? "draft";
  const isPublished = input.is_published ?? status === "published";
  const publishedAt =
    input.published_at ??
    (isPublished ? new Date().toISOString() : null);

  try {
    const [rows] = await db.query(
      `INSERT INTO ${WORKSHOPS_TABLE} (
         slug, title, tagline, description, eligibility_html, image_url,
         starts_on, ends_on, duration_label, locations, delivery_modes,
         features, procedures, seats_total, seats_left, price, currency,
         contact_phone, status, is_published, sort_order, published_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::text[],$12::jsonb,$13::jsonb,
         $14,$15,$16,$17,$18,$19,$20,$21,$22
       )
       RETURNING ${SELECT_COLS}`,
      [
        slug,
        input.title,
        input.tagline ?? null,
        input.description ?? null,
        input.eligibility_html ?? null,
        input.image_url ?? null,
        input.starts_on,
        input.ends_on || null,
        input.duration_label ?? null,
        input.locations ?? null,
        input.delivery_modes ?? [],
        JSON.stringify(input.features ?? []),
        JSON.stringify(input.procedures ?? []),
        input.seats_total ?? null,
        input.seats_left ?? input.seats_total ?? null,
        input.price ?? null,
        input.currency ?? "INR",
        input.contact_phone ?? null,
        status,
        isPublished,
        input.sort_order ?? 0,
        publishedAt,
      ],
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Workshop slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function updateWorkshop(id: string, patch: UpdateWorkshopInput) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const jsonFields = new Set(["features", "procedures"]);
  const arrayFields = new Set(["delivery_modes"]);

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (jsonFields.has(key)) {
      fields.push(`${key} = $${i++}::jsonb`);
      params.push(JSON.stringify(value ?? []));
      continue;
    }
    if (arrayFields.has(key)) {
      fields.push(`${key} = $${i++}::text[]`);
      params.push(Array.isArray(value) ? value : []);
      continue;
    }
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }

  if (!fields.length) return getWorkshopById(id);

  // When publishing, ensure flags — but don't double-assign columns already in the SET.
  if (patch.status === "published" && patch.is_published !== false) {
    if (patch.is_published === undefined) {
      fields.push(`is_published = true`);
    }
    if (patch.published_at === undefined) {
      fields.push(`published_at = COALESCE(published_at, now())`);
    }
  }

  fields.push("updated_at = now()");
  params.push(id);

  try {
    const [rows] = await db.query(
      `UPDATE ${WORKSHOPS_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING ${SELECT_COLS}`,
      params,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Workshop slug already exists"), {
        status: 409,
      });
    }
    throw err;
  }
}

export async function softDeleteWorkshop(id: string) {
  const [rows] = await db.query(
    `UPDATE ${WORKSHOPS_TABLE}
     SET deleted_at = now(), updated_at = now(), is_published = false
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function listPublicWorkshops(opts: {
  page: number;
  limit: number;
}) {
  const whereSql = `
    WHERE deleted_at IS NULL
      AND is_published = true
      AND status = 'published'
  `;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${WORKSHOPS_TABLE} ${whereSql}`,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT ${SELECT_COLS}
     FROM ${WORKSHOPS_TABLE}
     ${whereSql}
     ORDER BY sort_order ASC, starts_on ASC, created_at DESC
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
