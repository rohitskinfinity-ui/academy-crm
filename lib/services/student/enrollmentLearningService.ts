import { db } from "@/lib/db";
import {
  COURSES_TABLE,
  ENROLLMENT_TREATMENT_STAGES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  QUIZ_ATTEMPTS_TABLE,
  QUIZ_QUESTIONS_TABLE,
  TREATMENT_BOOKLETS_TABLE,
  TREATMENT_QUIZZES_TABLE,
  TREATMENT_VIDEOS_TABLE,
  TREATMENTS_TABLE,
  VIDEO_PROGRESS_TABLE,
  WORKSHOPS_TABLE,
} from "@/lib/db/schema";
import { getOwnedEnrollment } from "./access";

export async function listStudentEnrollments(userId: string) {
  const [rows] = await db.query<{
    id: string;
    title: string;
    status: string;
    progress_pct: number;
    course_id: string | null;
    workshop_id: string | null;
    course_title: string | null;
    workshop_title: string | null;
    type: "course" | "workshop";
    started_at: string | null;
    treatment_count: number;
  }>(
    `SELECT e.id,
            e.title,
            e.status::text AS status,
            e.progress_pct::float8 AS progress_pct,
            e.course_id,
            e.workshop_id,
            c.title AS course_title,
            w.title AS workshop_title,
            CASE WHEN e.workshop_id IS NOT NULL THEN 'workshop' ELSE 'course' END AS type,
            e.started_at::text AS started_at,
            (SELECT COUNT(*)::int FROM ${ENROLLMENT_TREATMENTS_TABLE} et
             WHERE et.enrollment_id = e.id) AS treatment_count
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id AND c.deleted_at IS NULL
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = e.workshop_id AND w.deleted_at IS NULL
     WHERE e.user_id = $1
       AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')
     ORDER BY e.created_at DESC`,
    [userId],
  );

  return Array.isArray(rows) ? rows : [];
}

export async function getStudentEnrollmentDetail(
  userId: string,
  enrollmentId: string,
) {
  const enrollment = await getOwnedEnrollment(userId, enrollmentId);
  if (!enrollment) {
    throw Object.assign(new Error("Enrollment not found"), { status: 404 });
  }

  const [metaRows] = await db.query<{
    course_title: string | null;
    workshop_title: string | null;
    type: "course" | "workshop";
  }>(
    `SELECT c.title AS course_title,
            w.title AS workshop_title,
            CASE WHEN e.workshop_id IS NOT NULL THEN 'workshop' ELSE 'course' END AS type
     FROM ${ENROLLMENTS_TABLE} e
     LEFT JOIN ${COURSES_TABLE} c ON c.id = e.course_id
     LEFT JOIN ${WORKSHOPS_TABLE} w ON w.id = e.workshop_id
     WHERE e.id = $1`,
    [enrollmentId],
  );
  const meta = Array.isArray(metaRows) ? metaRows[0] : null;

  const [etRows] = await db.query<{
    id: string;
    treatment_id: string;
    sort_order: number;
    hands_on_included: boolean;
    current_stage: string;
    treatment_name: string;
    treatment_slug: string;
    summary: string | null;
    image_url: string | null;
  }>(
    `SELECT et.id, et.treatment_id, et.sort_order, et.hands_on_included,
            et.current_stage::text AS current_stage,
            t.name AS treatment_name, t.slug AS treatment_slug,
            t.summary, t.image_url
     FROM ${ENROLLMENT_TREATMENTS_TABLE} et
     JOIN ${TREATMENTS_TABLE} t ON t.id = et.treatment_id AND t.deleted_at IS NULL
     WHERE et.enrollment_id = $1
     ORDER BY et.sort_order ASC`,
    [enrollmentId],
  );
  const treatments = Array.isArray(etRows) ? etRows : [];

  const pathway = [];
  for (const et of treatments) {
    const [stageRows] = await db.query<{
      stage: string;
      status: string;
      started_at: string | null;
      completed_at: string | null;
    }>(
      `SELECT stage::text AS stage, status::text AS status,
              started_at::text AS started_at, completed_at::text AS completed_at
       FROM ${ENROLLMENT_TREATMENT_STAGES_TABLE}
       WHERE enrollment_treatment_id = $1
       ORDER BY CASE stage
         WHEN 'theory' THEN 1
         WHEN 'observation' THEN 2
         WHEN 'training' THEN 3
         WHEN 'hands-on' THEN 4
       END`,
      [et.id],
    );

    const [videoRows] = await db.query<{
      id: string;
      title: string;
      stage: string;
      kind: string;
      duration_seconds: number | null;
      sort_order: number;
      has_file: boolean;
      last_position_seconds: number | null;
      watched_percent: number | null;
      is_completed: boolean | null;
    }>(
      `SELECT tv.id, tv.title, tv.stage::text AS stage, tv.kind::text AS kind,
              tv.duration_seconds, tv.sort_order,
              (tv.video_url IS NOT NULL AND tv.video_url <> '') AS has_file,
              vp.last_position_seconds,
              vp.watched_percent::float8 AS watched_percent,
              vp.is_completed
       FROM ${TREATMENT_VIDEOS_TABLE} tv
       LEFT JOIN ${VIDEO_PROGRESS_TABLE} vp
         ON vp.video_id = tv.id AND vp.enrollment_treatment_id = $2
       WHERE tv.treatment_id = $1
         AND tv.deleted_at IS NULL
         AND tv.is_published = true
       ORDER BY tv.stage, tv.sort_order`,
      [et.treatment_id, et.id],
    );

    const [bookletRows] = await db.query<{
      id: string;
      name: string;
      stage: string;
      mime_type: string | null;
      size_bytes: number | null;
      has_file: boolean;
      sort_order: number;
    }>(
      `SELECT id, name, stage::text AS stage, mime_type, size_bytes, sort_order,
              (file_url IS NOT NULL AND file_url <> '') AS has_file
       FROM ${TREATMENT_BOOKLETS_TABLE}
       WHERE treatment_id = $1 AND deleted_at IS NULL
       ORDER BY stage, sort_order`,
      [et.treatment_id],
    );

    const [quizRows] = await db.query<{
      id: string;
      title: string;
      pass_percent: number;
      is_required: boolean;
      question_count: number;
    }>(
      `SELECT tq.id, tq.title, tq.pass_percent::float8 AS pass_percent, tq.is_required,
              (SELECT COUNT(*)::int FROM ${QUIZ_QUESTIONS_TABLE} qq WHERE qq.quiz_id = tq.id) AS question_count
       FROM ${TREATMENT_QUIZZES_TABLE} tq
       WHERE tq.treatment_id = $1
       LIMIT 1`,
      [et.treatment_id],
    );
    const quiz = Array.isArray(quizRows) ? quizRows[0] ?? null : null;

    let quiz_passed = false;
    let best_percent: number | null = null;
    if (quiz) {
      const [attemptRows] = await db.query<{
        passed: boolean;
        percent: number;
      }>(
        `SELECT passed, percent::float8 AS percent
         FROM ${QUIZ_ATTEMPTS_TABLE}
         WHERE enrollment_treatment_id = $1 AND quiz_id = $2
         ORDER BY submitted_at DESC
         LIMIT 20`,
        [et.id, quiz.id],
      );
      const attempts = Array.isArray(attemptRows) ? attemptRows : [];
      quiz_passed = attempts.some((a) => a.passed);
      best_percent =
        attempts.length > 0
          ? Math.max(...attempts.map((a) => Number(a.percent) || 0))
          : null;
    }

    pathway.push({
      enrollment_treatment_id: et.id,
      treatment_id: et.treatment_id,
      sort_order: et.sort_order,
      hands_on_included: et.hands_on_included,
      current_stage: et.current_stage,
      name: et.treatment_name,
      slug: et.treatment_slug,
      summary: et.summary,
      stages: Array.isArray(stageRows) ? stageRows : [],
      videos: (Array.isArray(videoRows) ? videoRows : []).map((v) => ({
        id: v.id,
        title: v.title,
        stage: v.stage,
        kind: v.kind,
        duration_seconds: v.duration_seconds,
        sort_order: v.sort_order,
        has_file: Boolean(v.has_file),
        progress: {
          last_position_seconds: v.last_position_seconds ?? 0,
          watched_percent: v.watched_percent ?? 0,
          is_completed: Boolean(v.is_completed),
        },
      })),
      booklets: Array.isArray(bookletRows) ? bookletRows : [],
      quiz: quiz
        ? {
            id: quiz.id,
            title: quiz.title,
            pass_percent: quiz.pass_percent,
            is_required: quiz.is_required,
            question_count: quiz.question_count,
            passed: quiz_passed,
            best_percent,
          }
        : null,
    });
  }

  // Continue focus: first incomplete video or quiz
  let continue_focus: {
    treatment_id: string;
    treatment_name: string;
    video_id: string | null;
    label: string;
  } | null = null;

  for (const t of pathway) {
    const incompleteVideo = t.videos.find((v) => !v.progress.is_completed);
    if (incompleteVideo) {
      continue_focus = {
        treatment_id: t.treatment_id,
        treatment_name: t.name,
        video_id: incompleteVideo.id,
        label: `${t.name} · ${incompleteVideo.title}`,
      };
      break;
    }
    if (t.quiz && !t.quiz.passed) {
      continue_focus = {
        treatment_id: t.treatment_id,
        treatment_name: t.name,
        video_id: null,
        label: `${t.name} · Quiz`,
      };
      break;
    }
  }

  return {
    id: enrollment.id,
    title: enrollment.title,
    status: enrollment.status,
    progress_pct: Number(enrollment.progress_pct) || 0,
    course_id: enrollment.course_id,
    workshop_id: enrollment.workshop_id,
    course_title: meta?.course_title ?? null,
    workshop_title: meta?.workshop_title ?? null,
    type: meta?.type ?? "course",
    continue_focus,
    treatments: pathway,
  };
}
