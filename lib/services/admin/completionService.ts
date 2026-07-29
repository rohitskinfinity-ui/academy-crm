import { db } from "@/lib/db";
import {
  CALENDAR_EVENTS_TABLE,
  COURSE_TREATMENTS_TABLE,
  COURSES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  EVENT_ATTENDANCE_TABLE,
  QUIZ_ATTEMPTS_TABLE,
  TREATMENT_QUIZZES_TABLE,
  VIDEO_PROGRESS_TABLE,
} from "@/lib/db/schema";

type ProgrammeMeta = {
  min_live_attendance_pct?: number;
  min_hands_on_days_attended?: number;
};

export type CompletionCheck = {
  eligible: boolean;
  progress_pct: number;
  modules: {
    total: number;
    quiz_passed: number;
    videos_watched: number;
  };
  live: {
    required_pct: number;
    attended: number;
    total: number;
    pct: number;
    met: boolean;
  };
  hands_on: {
    required_days: number;
    attended: number;
    met: boolean;
  };
  blockers: string[];
};

export async function checkEnrollmentCompletion(
  enrollmentId: string,
): Promise<CompletionCheck> {
  const [enrRows] = await db.query<{
    user_id: string;
    course_id: string | null;
    batch_id: string | null;
  }>(
    `SELECT user_id, course_id, batch_id FROM ${ENROLLMENTS_TABLE} WHERE id = $1`,
    [enrollmentId],
  );
  const enrollment = Array.isArray(enrRows) ? enrRows[0] : null;
  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const blockers: string[] = [];

  const [courseRows] = await db.query<{ programme_meta: ProgrammeMeta }>(
    `SELECT programme_meta FROM ${COURSES_TABLE} WHERE id = $1`,
    [enrollment.course_id],
  );
  const programmeMeta = Array.isArray(courseRows)
    ? (courseRows[0]?.programme_meta ?? {})
    : {};

  const minLivePct = programmeMeta.min_live_attendance_pct ?? 75;
  const minHandsOnDays = programmeMeta.min_hands_on_days_attended ?? 7;

  const [modules] = await db.query<{ treatment_id: string }>(
    `SELECT treatment_id FROM ${ENROLLMENT_TREATMENTS_TABLE} WHERE enrollment_id = $1`,
    [enrollmentId],
  );
  const moduleList = Array.isArray(modules) ? modules : [];
  let quizPassed = 0;
  let videosWatched = 0;

  for (const mod of moduleList) {
    const [etRows] = await db.query<{ id: string }>(
      `SELECT id FROM ${ENROLLMENT_TREATMENTS_TABLE}
       WHERE enrollment_id = $1 AND treatment_id = $2`,
      [enrollmentId, mod.treatment_id],
    );
    const etId = Array.isArray(etRows) ? etRows[0]?.id : undefined;

    const [quizRows] = await db.query<{ id: string }>(
      `SELECT id FROM ${TREATMENT_QUIZZES_TABLE} WHERE treatment_id = $1`,
      [mod.treatment_id],
    );
    const quiz = Array.isArray(quizRows) ? quizRows[0] : null;
    if (quiz && etId) {
      const [attempts] = await db.query<{ passed: boolean }>(
        `SELECT passed FROM ${QUIZ_ATTEMPTS_TABLE}
         WHERE quiz_id = $1 AND enrollment_treatment_id = $2 AND passed = true
         LIMIT 1`,
        [quiz.id, etId],
      );
      if (Array.isArray(attempts) && attempts.length > 0) quizPassed++;
      else blockers.push(`Module quiz not passed (${mod.treatment_id})`);
    } else {
      quizPassed++;
    }

    if (etId) {
      const [videoProg] = await db.query<{ all_done: boolean }>(
        `SELECT COALESCE(bool_and(vp.is_completed), false) AS all_done
         FROM treatment_videos tv
         LEFT JOIN ${VIDEO_PROGRESS_TABLE} vp ON vp.video_id = tv.id AND vp.enrollment_treatment_id = $2
         WHERE tv.treatment_id = $1 AND tv.is_published = true`,
        [mod.treatment_id, etId],
      );
      const watched = Array.isArray(videoProg) ? videoProg[0]?.all_done : false;
      if (watched) videosWatched++;
      else blockers.push(`Required videos not completed (${mod.treatment_id})`);
    } else {
      blockers.push(`Enrollment treatment missing (${mod.treatment_id})`);
    }
  }

  const [liveEvents] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${CALENDAR_EVENTS_TABLE}
     WHERE course_id = $1 AND type = 'live_class' AND deleted_at IS NULL
       AND ($2::uuid IS NULL OR batch_id = $2 OR batch_id IS NULL)`,
    [enrollment.course_id, enrollment.batch_id],
  );
  const liveTotal = parseInt(
    Array.isArray(liveEvents) ? liveEvents[0]?.count ?? "0" : "0",
    10,
  );

  const [liveAttended] = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT ea.event_id)::text AS count
     FROM ${EVENT_ATTENDANCE_TABLE} ea
     JOIN ${CALENDAR_EVENTS_TABLE} ce ON ce.id = ea.event_id
     WHERE ea.user_id = $1 AND ce.course_id = $2 AND ce.type = 'live_class'`,
    [enrollment.user_id, enrollment.course_id],
  );
  const liveCount = parseInt(
    Array.isArray(liveAttended) ? liveAttended[0]?.count ?? "0" : "0",
    10,
  );
  const livePct = liveTotal > 0 ? (liveCount / liveTotal) * 100 : 100;
  const liveMet = livePct >= minLivePct;
  if (!liveMet) {
    blockers.push(
      `Live attendance ${livePct.toFixed(0)}% below required ${minLivePct}%`,
    );
  }

  const [handsOnAttended] = await db.query<{ count: string }>(
    `SELECT COUNT(DISTINCT ea.event_id)::text AS count
     FROM ${EVENT_ATTENDANCE_TABLE} ea
     JOIN ${CALENDAR_EVENTS_TABLE} ce ON ce.id = ea.event_id
     WHERE ea.user_id = $1 AND ce.course_id = $2 AND ce.type = 'workshop'`,
    [enrollment.user_id, enrollment.course_id],
  );
  const handsOnCount = parseInt(
    Array.isArray(handsOnAttended) ? handsOnAttended[0]?.count ?? "0" : "0",
    10,
  );
  const handsOnMet = handsOnCount >= minHandsOnDays;
  if (!handsOnMet) {
    blockers.push(
      `Hands-on days ${handsOnCount}/${minHandsOnDays} not met`,
    );
  }

  const modulesMet =
    moduleList.length > 0 &&
    quizPassed >= moduleList.length &&
    videosWatched >= moduleList.length;

  const eligible = modulesMet && liveMet && handsOnMet && blockers.length === 0;

  const modulePct =
    moduleList.length > 0
      ? ((quizPassed + videosWatched) / (moduleList.length * 2)) * 100
      : 0;
  const progressPct = Math.min(
    100,
    (modulePct * 0.5 + livePct * 0.25 + (handsOnMet ? 25 : 0)),
  );

  return {
    eligible,
    progress_pct: Math.round(progressPct * 100) / 100,
    modules: {
      total: moduleList.length,
      quiz_passed: quizPassed,
      videos_watched: videosWatched,
    },
    live: {
      required_pct: minLivePct,
      attended: liveCount,
      total: liveTotal,
      pct: Math.round(livePct * 100) / 100,
      met: liveMet,
    },
    hands_on: {
      required_days: minHandsOnDays,
      attended: handsOnCount,
      met: handsOnMet,
    },
    blockers: eligible ? [] : blockers.slice(0, 10),
  };
}

export async function syncEnrollmentProgress(enrollmentId: string) {
  const check = await checkEnrollmentCompletion(enrollmentId);
  await db.query(
    `UPDATE ${ENROLLMENTS_TABLE}
     SET progress_pct = $1, updated_at = now()
     WHERE id = $2`,
    [check.progress_pct, enrollmentId],
  );
  return check;
}

export async function getCourseModuleCount(courseId: string) {
  const [rows] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${COURSE_TREATMENTS_TABLE} WHERE course_id = $1`,
    [courseId],
  );
  return parseInt(Array.isArray(rows) ? rows[0]?.count ?? "0" : "0", 10);
}
