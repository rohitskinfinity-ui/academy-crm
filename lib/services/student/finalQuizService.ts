import { db } from "@/lib/db";
import {
  COURSE_FINAL_QUIZ_ATTEMPTS_TABLE,
  COURSE_FINAL_QUIZ_QUESTIONS_TABLE,
  COURSE_FINAL_QUIZZES_TABLE,
} from "@/lib/db/schema";
import { checkCertificateEligibility } from "@/lib/certificates/eligibility";
import { CERT_MIN_PROGRESS_PCT } from "@/lib/certificates/constants";
import { getOwnedEnrollment } from "./access";

export async function getStudentFinalQuiz(userId: string, enrollmentId: string) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment?.course_id) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const eligibility = await checkCertificateEligibility(enrollmentId);
  if (!eligibility.progress_met) {
    throw Object.assign(
      new Error(
        `Complete at least ${CERT_MIN_PROGRESS_PCT}% of the course before taking the certificate quiz`,
      ),
      {
        status: 403,
        progress_pct: eligibility.progress_pct,
        required: CERT_MIN_PROGRESS_PCT,
      },
    );
  }

  const [quizRows] = await db.query<{
    id: string;
    title: string;
    pass_percent: number;
    is_published: boolean;
  }>(
    `SELECT id, title, pass_percent::float8 AS pass_percent, is_published
     FROM ${COURSE_FINAL_QUIZZES_TABLE}
     WHERE course_id = $1
     LIMIT 1`,
    [enrollment.course_id],
  );
  const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
  if (!quiz || !quiz.is_published) {
    throw Object.assign(new Error("Certificate quiz is not available"), {
      status: 404,
    });
  }

  const [questions] = await db.query<{
    id: string;
    prompt: string;
    options: unknown;
    sort_order: number;
  }>(
    `SELECT id, prompt, options, sort_order
     FROM ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
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
     FROM ${COURSE_FINAL_QUIZ_ATTEMPTS_TABLE}
     WHERE enrollment_id = $1 AND quiz_id = $2
     ORDER BY submitted_at DESC
     LIMIT 10`,
    [enrollmentId, quiz.id],
  );

  return {
    enrollment_id: enrollmentId,
    progress_pct: eligibility.progress_pct,
    quiz: {
      id: quiz.id,
      title: quiz.title,
      pass_percent: quiz.pass_percent,
      questions: (Array.isArray(questions) ? questions : []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        sort_order: q.sort_order,
      })),
    },
    attempts: Array.isArray(attempts) ? attempts : [],
    already_passed: (Array.isArray(attempts) ? attempts : []).some((a) => a.passed),
  };
}

export async function submitStudentFinalQuiz(
  userId: string,
  enrollmentId: string,
  answers: Record<string, number>,
) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment?.course_id) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const eligibility = await checkCertificateEligibility(enrollmentId);
  if (!eligibility.progress_met) {
    throw Object.assign(
      new Error(
        `Complete at least ${CERT_MIN_PROGRESS_PCT}% of the course before taking the certificate quiz`,
      ),
      {
        status: 403,
        progress_pct: eligibility.progress_pct,
        required: CERT_MIN_PROGRESS_PCT,
      },
    );
  }

  const [quizRows] = await db.query<{
    id: string;
    pass_percent: number;
    is_published: boolean;
  }>(
    `SELECT id, pass_percent::float8 AS pass_percent, is_published
     FROM ${COURSE_FINAL_QUIZZES_TABLE}
     WHERE course_id = $1
     LIMIT 1`,
    [enrollment.course_id],
  );
  const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
  if (!quiz || !quiz.is_published) {
    throw Object.assign(new Error("Certificate quiz is not available"), {
      status: 404,
    });
  }

  const [questions] = await db.query<{
    id: string;
    correct_index: number;
  }>(
    `SELECT id, correct_index FROM ${COURSE_FINAL_QUIZ_QUESTIONS_TABLE}
     WHERE quiz_id = $1`,
    [quiz.id],
  );
  const qs = Array.isArray(questions) ? questions : [];
  if (!qs.length) {
    throw Object.assign(new Error("Certificate quiz has no questions"), {
      status: 422,
    });
  }

  const maxScore = qs.length;
  let score = 0;
  for (const q of qs) {
    if (Number(answers[q.id]) === Number(q.correct_index)) score += 1;
  }
  const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const passed = percent >= Number(quiz.pass_percent);

  const [created] = await db.query<{ id: string }>(
    `INSERT INTO ${COURSE_FINAL_QUIZ_ATTEMPTS_TABLE}
       (enrollment_id, quiz_id, answers, score, max_score, percent, passed)
     VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
     RETURNING id`,
    [
      enrollmentId,
      quiz.id,
      JSON.stringify(answers),
      score,
      maxScore,
      percent,
      passed,
    ],
  );

  return {
    attempt_id: Array.isArray(created) ? created[0]?.id : null,
    score,
    max_score: maxScore,
    percent: Math.round(percent * 100) / 100,
    passed,
    pass_percent: quiz.pass_percent,
    awaiting_admin: passed,
  };
}
