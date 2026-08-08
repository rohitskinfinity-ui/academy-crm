import { db } from "@/lib/db";
import {
  COURSE_FINAL_QUIZ_ATTEMPTS_TABLE,
  COURSE_FINAL_QUIZZES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
} from "@/lib/db/schema";
import { syncEnrollmentProgress } from "@/lib/services/admin/completionService";
import { CERT_MIN_PROGRESS_PCT } from "./constants";

export type CertificateEligibility = {
  eligible: boolean;
  progress_pct: number;
  progress_met: boolean;
  quiz_published: boolean;
  quiz_id: string | null;
  quiz_pass_percent: number | null;
  quiz_best_percent: number | null;
  quiz_passed: boolean;
  quiz_unlocked: boolean;
  blockers: string[];
};

export async function checkCertificateEligibility(
  enrollmentId: string,
): Promise<CertificateEligibility> {
  const completion = await syncEnrollmentProgress(enrollmentId);
  const progressPct = Number(completion.progress_pct) || 0;
  const progressMet = progressPct >= CERT_MIN_PROGRESS_PCT;

  const [enrRows] = await db.query<{
    course_id: string | null;
    workshop_id: string | null;
  }>(
    `SELECT course_id, workshop_id FROM ${ENROLLMENTS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL`,
    [enrollmentId],
  );
  const enrollment = Array.isArray(enrRows) ? enrRows[0] : null;
  const courseId = enrollment?.course_id ?? null;
  const workshopId = enrollment?.workshop_id ?? null;

  const [treatmentRows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${ENROLLMENT_TREATMENTS_TABLE}
     WHERE enrollment_id = $1`,
    [enrollmentId],
  );
  const treatmentCount = parseInt(
    Array.isArray(treatmentRows) ? (treatmentRows[0]?.count ?? "0") : "0",
    10,
  );

  const blockers: string[] = [];

  // Workshops / custom pathways have no catalog final quiz. If there is no
  // learning content, progress stays 0% — still allow LMS download after upload.
  if (!courseId && workshopId) {
    const workshopProgressMet =
      treatmentCount === 0 ? true : progressPct >= CERT_MIN_PROGRESS_PCT;
    if (!workshopProgressMet) {
      blockers.push(
        `Workshop progress ${progressPct.toFixed(0)}% below required ${CERT_MIN_PROGRESS_PCT}%`,
      );
    }
    return {
      eligible: workshopProgressMet,
      progress_pct: progressPct,
      progress_met: workshopProgressMet,
      quiz_published: false,
      quiz_id: null,
      quiz_pass_percent: null,
      quiz_best_percent: null,
      quiz_passed: true,
      quiz_unlocked: workshopProgressMet,
      blockers: workshopProgressMet ? [] : blockers,
    };
  }

  if (!progressMet) {
    blockers.push(
      `Course progress ${progressPct.toFixed(0)}% below required ${CERT_MIN_PROGRESS_PCT}%`,
    );
  }

  if (!courseId) {
    blockers.push("Enrollment is not linked to a catalog course or workshop");
    return {
      eligible: false,
      progress_pct: progressPct,
      progress_met: progressMet,
      quiz_published: false,
      quiz_id: null,
      quiz_pass_percent: null,
      quiz_best_percent: null,
      quiz_passed: false,
      quiz_unlocked: false,
      blockers,
    };
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
    [courseId],
  );
  const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
  const quizPublished = Boolean(quiz?.is_published);
  if (!quiz || !quizPublished) {
    blockers.push("Certificate quiz is not published for this course");
  }

  let quizBest: number | null = null;
  let quizPassed = false;
  if (quiz) {
    const [attemptRows] = await db.query<{
      percent: number;
      passed: boolean;
    }>(
      `SELECT percent::float8 AS percent, passed
       FROM ${COURSE_FINAL_QUIZ_ATTEMPTS_TABLE}
       WHERE enrollment_id = $1 AND quiz_id = $2
       ORDER BY percent DESC
       LIMIT 1`,
      [enrollmentId, quiz.id],
    );
    const best = Array.isArray(attemptRows) ? attemptRows[0] : null;
    if (best) {
      quizBest = Number(best.percent) || 0;
      quizPassed = Boolean(best.passed) || quizBest >= Number(quiz.pass_percent);
    }
    if (!quizPassed) {
      blockers.push(
        `Certificate quiz not passed (need ${Number(quiz.pass_percent)}%)`,
      );
    }
  }

  const quizUnlocked = progressMet && quizPublished;
  const eligible = progressMet && quizPublished && quizPassed;

  return {
    eligible,
    progress_pct: progressPct,
    progress_met: progressMet,
    quiz_published: quizPublished,
    quiz_id: quiz?.id ?? null,
    quiz_pass_percent: quiz ? Number(quiz.pass_percent) : null,
    quiz_best_percent: quizBest,
    quiz_passed: quizPassed,
    quiz_unlocked: quizUnlocked,
    blockers: eligible ? [] : blockers.slice(0, 10),
  };
}
