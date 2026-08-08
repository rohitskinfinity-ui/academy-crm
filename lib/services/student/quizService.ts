import { db } from "@/lib/db";
import {
  ENROLLMENT_TREATMENT_STAGES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  QUIZ_ATTEMPTS_TABLE,
  QUIZ_QUESTIONS_TABLE,
  TREATMENT_QUIZZES_TABLE,
} from "@/lib/db/schema";
import { syncEnrollmentProgress } from "@/lib/services/admin/completionService";
import { getEnrollmentTreatmentAccess, assertStageUnlocked } from "./access";

export async function getStudentQuiz(
  userId: string,
  enrollmentId: string,
  treatmentId: string,
) {
  const access = await getEnrollmentTreatmentAccess(
    userId,
    enrollmentId,
    treatmentId,
  );
  if (!access) {
    throw Object.assign(new Error("Enrollment treatment not found"), {
      status: 404,
    });
  }
  await assertStageUnlocked(access.enrollment_treatment_id, "theory");

  const [quizRows] = await db.query<{
    id: string;
    title: string;
    pass_percent: number;
    is_required: boolean;
  }>(
    `SELECT id, title, pass_percent::float8 AS pass_percent, is_required
     FROM ${TREATMENT_QUIZZES_TABLE}
     WHERE treatment_id = $1
     LIMIT 1`,
    [treatmentId],
  );
  const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { status: 404 });
  }

  const [questions] = await db.query<{
    id: string;
    prompt: string;
    options: unknown;
    sort_order: number;
  }>(
    `SELECT id, prompt, options, sort_order
     FROM ${QUIZ_QUESTIONS_TABLE}
     WHERE quiz_id = $1
     ORDER BY sort_order`,
    [quiz.id],
  );

  const [attempts] = await db.query<{
    id: string;
    score: number;
    max_score: number;
    percent: number;
    passed: boolean;
    submitted_at: string;
  }>(
    `SELECT id, score, max_score, percent::float8 AS percent, passed,
            submitted_at::text AS submitted_at
     FROM ${QUIZ_ATTEMPTS_TABLE}
     WHERE enrollment_treatment_id = $1 AND quiz_id = $2
     ORDER BY submitted_at DESC
     LIMIT 10`,
    [access.enrollment_treatment_id, quiz.id],
  );

  return {
    enrollment_id: enrollmentId,
    treatment_id: treatmentId,
    enrollment_treatment_id: access.enrollment_treatment_id,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      pass_percent: quiz.pass_percent,
      is_required: quiz.is_required,
      questions: (Array.isArray(questions) ? questions : []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        sort_order: q.sort_order,
      })),
    },
    attempts: Array.isArray(attempts) ? attempts : [],
    already_passed: (Array.isArray(attempts) ? attempts : []).some(
      (a) => a.passed,
    ),
  };
}

export async function submitStudentQuiz(
  userId: string,
  enrollmentId: string,
  treatmentId: string,
  answers: Record<string, number>,
) {
  const access = await getEnrollmentTreatmentAccess(
    userId,
    enrollmentId,
    treatmentId,
  );
  if (!access) {
    throw Object.assign(new Error("Enrollment treatment not found"), {
      status: 404,
    });
  }
  await assertStageUnlocked(access.enrollment_treatment_id, "theory");

  const [quizRows] = await db.query<{
    id: string;
    pass_percent: number;
  }>(
    `SELECT id, pass_percent::float8 AS pass_percent
     FROM ${TREATMENT_QUIZZES_TABLE}
     WHERE treatment_id = $1
     LIMIT 1`,
    [treatmentId],
  );
  const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
  if (!quiz) {
    throw Object.assign(new Error("Quiz not found"), { status: 404 });
  }

  const [questions] = await db.query<{
    id: string;
    correct_index: number;
  }>(
    `SELECT id, correct_index FROM ${QUIZ_QUESTIONS_TABLE} WHERE quiz_id = $1`,
    [quiz.id],
  );
  const qs = Array.isArray(questions) ? questions : [];
  const maxScore = qs.length;
  let score = 0;
  for (const q of qs) {
    if (Number(answers[q.id]) === Number(q.correct_index)) score += 1;
  }
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const passed = percent >= Number(quiz.pass_percent);

  const [created] = await db.query<{ id: string }>(
    `INSERT INTO ${QUIZ_ATTEMPTS_TABLE}
       (enrollment_treatment_id, quiz_id, answers, score, max_score, percent, passed)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING id`,
    [
      access.enrollment_treatment_id,
      quiz.id,
      JSON.stringify(answers),
      score,
      maxScore,
      percent,
      passed,
    ],
  );

  if (passed) {
    await db.query(
      `UPDATE ${ENROLLMENT_TREATMENT_STAGES_TABLE}
       SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
       WHERE enrollment_treatment_id = $1 AND stage = 'theory'`,
      [access.enrollment_treatment_id],
    );
    await db.query(
      `UPDATE ${ENROLLMENT_TREATMENT_STAGES_TABLE}
       SET status = CASE WHEN status = 'locked' THEN 'available' ELSE status END,
           started_at = COALESCE(started_at, now()),
           updated_at = now()
       WHERE enrollment_treatment_id = $1 AND stage = 'observation'`,
      [access.enrollment_treatment_id],
    );
    await db.query(
      `UPDATE ${ENROLLMENT_TREATMENTS_TABLE}
       SET current_stage = CASE
             WHEN current_stage = 'theory' THEN 'observation'::treatment_stage
             ELSE current_stage
           END,
           updated_at = now()
       WHERE id = $1`,
      [access.enrollment_treatment_id],
    );
  }

  const progress = await syncEnrollmentProgress(enrollmentId);

  return {
    attempt_id: Array.isArray(created) ? created[0]?.id : null,
    score,
    max_score: maxScore,
    percent: Math.round(percent * 100) / 100,
    passed,
    pass_percent: quiz.pass_percent,
    enrollment_progress_pct: progress.progress_pct,
  };
}
