import { db, withTransaction } from "@/lib/db";
import {
  COURSE_FINAL_QUIZ_QUESTIONS_TABLE,
  COURSE_FINAL_QUIZZES_TABLE,
  COURSES_TABLE,
} from "@/lib/db/schema";
import { CERT_FINAL_QUIZ_PASS_PERCENT } from "@/lib/certificates/constants";

async function assertCourseExists(courseId: string) {
  const [rows] = await db.query<{ id: string }>(
    `SELECT id FROM ${COURSES_TABLE} WHERE id = $1 AND deleted_at IS NULL`,
    [courseId],
  );
  if (!Array.isArray(rows) || !rows[0]) {
    throw Object.assign(new Error("Course not found"), { status: 404 });
  }
}

export async function getCourseFinalQuiz(courseId: string) {
  await assertCourseExists(courseId);
  const [quizzes] = await db.query(
    `SELECT id, course_id, title, pass_percent::float8 AS pass_percent,
            is_published, created_at, updated_at
     FROM ${COURSE_FINAL_QUIZZES_TABLE} WHERE course_id = $1`,
    [courseId],
  );
  const quiz = Array.isArray(quizzes) ? quizzes[0] : null;
  if (!quiz) return null;
  const [questions] = await db.query(
    `SELECT * FROM ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
     WHERE quiz_id = $1 ORDER BY sort_order, created_at`,
    [(quiz as { id: string }).id],
  );
  return { ...quiz, questions: Array.isArray(questions) ? questions : [] };
}

export async function upsertCourseFinalQuiz(
  courseId: string,
  input: {
    title: string;
    pass_percent: number;
    is_published: boolean;
  },
) {
  await assertCourseExists(courseId);
  const [rows] = await db.query(
    `INSERT INTO ${COURSE_FINAL_QUIZZES_TABLE}
       (course_id, title, pass_percent, is_published)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (course_id) DO UPDATE SET
       title = EXCLUDED.title,
       pass_percent = EXCLUDED.pass_percent,
       is_published = EXCLUDED.is_published,
       updated_at = now()
     RETURNING id, course_id, title, pass_percent::float8 AS pass_percent,
               is_published, created_at, updated_at`,
    [
      courseId,
      input.title,
      input.pass_percent ?? CERT_FINAL_QUIZ_PASS_PERCENT,
      input.is_published,
    ],
  );
  return Array.isArray(rows) ? rows[0] : null;
}

export async function createFinalQuizQuestion(
  courseId: string,
  input: {
    prompt: string;
    options: string[];
    correct_index: number;
    explanation?: string | null;
    sort_order?: number;
  },
) {
  if (input.correct_index >= input.options.length) {
    throw Object.assign(new Error("correct_index out of range for options"), {
      status: 400,
    });
  }

  return withTransaction(async (conn) => {
    const [quizzes] = await conn.query<{ id: string }>(
      `SELECT id FROM ${COURSE_FINAL_QUIZZES_TABLE} WHERE course_id = $1`,
      [courseId],
    );
    let quizId = Array.isArray(quizzes) ? quizzes[0]?.id : undefined;
    if (!quizId) {
      const [created] = await conn.query<{ id: string }>(
        `INSERT INTO ${COURSE_FINAL_QUIZZES_TABLE} (course_id)
         VALUES ($1) RETURNING id`,
        [courseId],
      );
      quizId = Array.isArray(created) ? created[0]?.id : undefined;
    }
    if (!quizId) throw new Error("Failed to create certificate quiz");

    const [countRows] = await conn.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
       WHERE quiz_id = $1`,
      [quizId],
    );
    const nextOrder =
      input.sort_order ??
      parseInt(Array.isArray(countRows) ? countRows[0]?.count ?? "0" : "0", 10);

    const [rows] = await conn.query(
      `INSERT INTO ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
         (quiz_id, prompt, options, correct_index, explanation, sort_order)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6)
       RETURNING *`,
      [
        quizId,
        input.prompt,
        JSON.stringify(input.options),
        input.correct_index,
        input.explanation ?? null,
        nextOrder,
      ],
    );
    return Array.isArray(rows) ? rows[0] : null;
  });
}

export async function updateFinalQuizQuestion(
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
    `UPDATE ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function deleteFinalQuizQuestion(questionId: string) {
  const [rows] = await db.query(
    `DELETE FROM ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE} WHERE id = $1 RETURNING id`,
    [questionId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
