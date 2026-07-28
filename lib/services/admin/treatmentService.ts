import { db, withTransaction } from "@/lib/db";
import {
  QUIZ_QUESTIONS_TABLE,
  TREATMENT_BOOKLETS_TABLE,
  TREATMENT_QUIZZES_TABLE,
  TREATMENT_STAGES_TABLE,
  TREATMENT_VIDEOS_TABLE,
  TREATMENTS_TABLE,
} from "@/lib/db/schema";

export type TreatmentRow = Record<string, unknown>;

export async function listTreatments(opts: {
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
    where.push(`(name ILIKE $${i} OR slug ILIKE $${i} OR summary ILIKE $${i})`);
    params.push(`%${opts.search.trim()}%`);
    i++;
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const offset = (opts.page - 1) * opts.limit;

  const [countRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${TREATMENTS_TABLE} ${whereSql}`,
    params,
  );
  const total = Array.isArray(countRows)
    ? parseInt(countRows[0]?.count ?? "0", 10)
    : 0;

  const [rows] = await db.query(
    `SELECT * FROM ${TREATMENTS_TABLE}
     ${whereSql}
     ORDER BY sort_order ASC, created_at DESC
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

export async function getTreatmentById(id: string) {
  const [rows] = await db.query(
    `SELECT * FROM ${TREATMENTS_TABLE} WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  const treatment = Array.isArray(rows) ? rows[0] : null;
  if (!treatment) return null;

  const [stages] = await db.query(
    `SELECT * FROM ${TREATMENT_STAGES_TABLE} WHERE treatment_id = $1 ORDER BY sort_order`,
    [id],
  );
  const [videos] = await db.query(
    `SELECT * FROM ${TREATMENT_VIDEOS_TABLE}
     WHERE treatment_id = $1 AND deleted_at IS NULL
     ORDER BY stage, sort_order`,
    [id],
  );
  const [booklets] = await db.query(
    `SELECT * FROM ${TREATMENT_BOOKLETS_TABLE}
     WHERE treatment_id = $1 AND deleted_at IS NULL
     ORDER BY stage, sort_order`,
    [id],
  );
  const [quizzes] = await db.query(
    `SELECT * FROM ${TREATMENT_QUIZZES_TABLE} WHERE treatment_id = $1`,
    [id],
  );
  const quiz = Array.isArray(quizzes) ? quizzes[0] : null;
  let questions: unknown[] = [];
  if (quiz) {
    const [qRows] = await db.query(
      `SELECT * FROM ${QUIZ_QUESTIONS_TABLE}
       WHERE quiz_id = $1 ORDER BY sort_order`,
      [(quiz as { id: string }).id],
    );
    questions = Array.isArray(qRows) ? qRows : [];
  }

  return {
    ...treatment,
    stages: Array.isArray(stages) ? stages : [],
    videos: Array.isArray(videos) ? videos : [],
    booklets: Array.isArray(booklets) ? booklets : [],
    quiz: quiz ? { ...quiz, questions } : null,
  };
}

export async function createTreatment(input: {
  slug: string;
  name: string;
  summary?: string | null;
  image_url?: string | null;
  status: string;
  sort_order: number;
  base_price?: number | null;
  currency: string;
}) {
  try {
    const [rows] = await db.query(
      `INSERT INTO ${TREATMENTS_TABLE}
         (slug, name, summary, image_url, status, sort_order, base_price, currency)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        input.slug,
        input.name,
        input.summary ?? null,
        input.image_url ?? null,
        input.status,
        input.sort_order,
        input.base_price ?? null,
        input.currency,
      ],
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Slug already exists"), { status: 409 });
    }
    throw err;
  }
}

export async function updateTreatment(
  id: string,
  patch: Record<string, unknown>,
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }
  if (!fields.length) return getTreatmentById(id);
  fields.push("updated_at = now()");
  params.push(id);

  try {
    const [rows] = await db.query(
      `UPDATE ${TREATMENTS_TABLE}
       SET ${fields.join(", ")}
       WHERE id = $${i} AND deleted_at IS NULL
       RETURNING *`,
      params,
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      throw Object.assign(new Error("Slug already exists"), { status: 409 });
    }
    throw err;
  }
}

export async function softDeleteTreatment(id: string) {
  const [rows] = await db.query(
    `UPDATE ${TREATMENTS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [id],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function upsertStage(
  treatmentId: string,
  input: {
    stage: string;
    title: string;
    description?: string | null;
    checklist: string[];
    sort_order: number;
  },
) {
  const [rows] = await db.query(
    `INSERT INTO ${TREATMENT_STAGES_TABLE}
       (treatment_id, stage, title, description, checklist, sort_order)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6)
     ON CONFLICT (treatment_id, stage) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       checklist = EXCLUDED.checklist,
       sort_order = EXCLUDED.sort_order,
       updated_at = now()
     RETURNING *`,
    [
      treatmentId,
      input.stage,
      input.title,
      input.description ?? null,
      JSON.stringify(input.checklist),
      input.sort_order,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function listStages(treatmentId: string) {
  const [rows] = await db.query(
    `SELECT * FROM ${TREATMENT_STAGES_TABLE}
     WHERE treatment_id = $1 ORDER BY sort_order`,
    [treatmentId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createVideo(
  treatmentId: string,
  input: Record<string, unknown>,
) {
  const [rows] = await db.query(
    `INSERT INTO ${TREATMENT_VIDEOS_TABLE}
       (treatment_id, stage, title, kind, duration_seconds, video_url,
        thumbnail_url, instructor_id, sort_order, is_published)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      treatmentId,
      input.stage,
      input.title,
      input.kind,
      input.duration_seconds ?? null,
      input.video_url ?? null,
      input.thumbnail_url ?? null,
      input.instructor_id ?? null,
      input.sort_order ?? 0,
      input.is_published ?? true,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateVideo(videoId: string, patch: Record<string, unknown>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }
  if (!fields.length) return null;
  fields.push("updated_at = now()");
  params.push(videoId);
  const [rows] = await db.query(
    `UPDATE ${TREATMENT_VIDEOS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function softDeleteVideo(videoId: string) {
  const [rows] = await db.query(
    `UPDATE ${TREATMENT_VIDEOS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [videoId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function listVideos(treatmentId: string) {
  const [rows] = await db.query(
    `SELECT * FROM ${TREATMENT_VIDEOS_TABLE}
     WHERE treatment_id = $1 AND deleted_at IS NULL
     ORDER BY stage, sort_order`,
    [treatmentId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function createBooklet(
  treatmentId: string,
  input: Record<string, unknown>,
) {
  const [rows] = await db.query(
    `INSERT INTO ${TREATMENT_BOOKLETS_TABLE}
       (treatment_id, stage, name, file_url, drive_url, size_bytes, mime_type, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      treatmentId,
      input.stage,
      input.name,
      input.file_url ?? null,
      input.drive_url ?? null,
      input.size_bytes ?? null,
      input.mime_type ?? null,
      input.sort_order ?? 0,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function updateBooklet(
  bookletId: string,
  patch: Record<string, unknown>,
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    fields.push(`${key} = $${i++}`);
    params.push(value);
  }
  if (!fields.length) return null;
  fields.push("updated_at = now()");
  params.push(bookletId);
  const [rows] = await db.query(
    `UPDATE ${TREATMENT_BOOKLETS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function softDeleteBooklet(bookletId: string) {
  const [rows] = await db.query(
    `UPDATE ${TREATMENT_BOOKLETS_TABLE}
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id`,
    [bookletId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function listBooklets(treatmentId: string) {
  const [rows] = await db.query(
    `SELECT * FROM ${TREATMENT_BOOKLETS_TABLE}
     WHERE treatment_id = $1 AND deleted_at IS NULL
     ORDER BY stage, sort_order`,
    [treatmentId],
  );
  return Array.isArray(rows) ? rows : [];
}

export async function upsertQuiz(
  treatmentId: string,
  input: { title: string; pass_percent: number; is_required: boolean },
) {
  const [rows] = await db.query(
    `INSERT INTO ${TREATMENT_QUIZZES_TABLE}
       (treatment_id, title, pass_percent, is_required)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (treatment_id) DO UPDATE SET
       title = EXCLUDED.title,
       pass_percent = EXCLUDED.pass_percent,
       is_required = EXCLUDED.is_required,
       updated_at = now()
     RETURNING *`,
    [treatmentId, input.title, input.pass_percent, input.is_required],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function getQuiz(treatmentId: string) {
  const [quizzes] = await db.query(
    `SELECT * FROM ${TREATMENT_QUIZZES_TABLE} WHERE treatment_id = $1`,
    [treatmentId],
  );
  const quiz = Array.isArray(quizzes) ? quizzes[0] : null;
  if (!quiz) return null;
  const [questions] = await db.query(
    `SELECT * FROM ${QUIZ_QUESTIONS_TABLE}
     WHERE quiz_id = $1 ORDER BY sort_order`,
    [(quiz as { id: string }).id],
  );
  return { ...quiz, questions: Array.isArray(questions) ? questions : [] };
}

export async function createQuestion(
  treatmentId: string,
  input: {
    prompt: string;
    options: string[];
    correct_index: number;
    explanation?: string | null;
    sort_order: number;
  },
) {
  return withTransaction(async (conn) => {
    const [quizzes] = await conn.query<{ id: string }>(
      `SELECT id FROM ${TREATMENT_QUIZZES_TABLE} WHERE treatment_id = $1`,
      [treatmentId],
    );
    let quizId = Array.isArray(quizzes) ? quizzes[0]?.id : undefined;
    if (!quizId) {
      const [created] = await conn.query<{ id: string }>(
        `INSERT INTO ${TREATMENT_QUIZZES_TABLE} (treatment_id)
         VALUES ($1) RETURNING id`,
        [treatmentId],
      );
      quizId = Array.isArray(created) ? created[0]?.id : undefined;
    }
    if (!quizId) throw new Error("Failed to create quiz");

    if (input.correct_index >= input.options.length) {
      throw Object.assign(
        new Error("correct_index out of range for options"),
        { status: 400 },
      );
    }

    const [rows] = await conn.query(
      `INSERT INTO ${QUIZ_QUESTIONS_TABLE}
         (quiz_id, prompt, options, correct_index, explanation, sort_order)
       VALUES ($1,$2,$3::jsonb,$4,$5,$6)
       RETURNING *`,
      [
        quizId,
        input.prompt,
        JSON.stringify(input.options),
        input.correct_index,
        input.explanation ?? null,
        input.sort_order,
      ],
    );
    return Array.isArray(rows) ? rows[0] : null;
  });
}

export async function updateQuestion(
  questionId: string,
  patch: Record<string, unknown>,
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "options") {
      fields.push(`options = $${i++}::jsonb`);
      params.push(JSON.stringify(value));
    } else {
      fields.push(`${key} = $${i++}`);
      params.push(value);
    }
  }
  if (!fields.length) return null;
  fields.push("updated_at = now()");
  params.push(questionId);
  const [rows] = await db.query(
    `UPDATE ${QUIZ_QUESTIONS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function deleteQuestion(questionId: string) {
  const [rows] = await db.query(
    `DELETE FROM ${QUIZ_QUESTIONS_TABLE} WHERE id = $1 RETURNING id`,
    [questionId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
