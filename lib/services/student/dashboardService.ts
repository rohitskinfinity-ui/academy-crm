import { db } from "@/lib/db";
import {
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { syncEnrollmentProgress } from "@/lib/services/admin/completionService";
import {
  getStudentEnrollmentDetail,
  listStudentEnrollments,
} from "./enrollmentLearningService";
import { listStudentLiveClasses } from "./liveClassService";

export async function getStudentDashboard(userId: string) {
  const [userRows] = await db.query<{
    full_name: string;
    display_name: string | null;
    email: string;
  }>(
    `SELECT full_name, display_name, email::text AS email
     FROM ${USERS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [userId],
  );
  const user = Array.isArray(userRows) ? userRows[0] : null;

  let enrollments = await listStudentEnrollments(userId);
  // Refresh stale progress_pct with learning-content formula (videos + quizzes).
  for (const enr of enrollments.filter((e) =>
    ["active", "completed"].includes(e.status),
  )) {
    try {
      await syncEnrollmentProgress(enr.id);
    } catch {
      // Keep listed value if sync fails for one enrollment.
    }
  }
  enrollments = await listStudentEnrollments(userId);

  const active = enrollments.filter((e) => e.status === "active");
  const treatmentCount = enrollments.reduce(
    (sum, e) => sum + (Number(e.treatment_count) || 0),
    0,
  );
  const avgProgress =
    enrollments.length > 0
      ? Math.round(
          (enrollments.reduce((s, e) => s + (Number(e.progress_pct) || 0), 0) /
            enrollments.length) *
            100,
        ) / 100
      : 0;

  const continueLearning = [];
  for (const enr of active.slice(0, 5)) {
    try {
      const detail = await getStudentEnrollmentDetail(userId, enr.id);
      continueLearning.push({
        enrollment_id: enr.id,
        title: enr.title,
        progress_pct: enr.progress_pct,
        type: enr.type,
        focus: detail.continue_focus,
        treatments_left: detail.treatments.filter((t) => {
          const allVideosDone = t.videos.every((v) => v.progress.is_completed);
          const quizOk = !t.quiz || t.quiz.passed;
          return !(allVideosDone && quizOk);
        }).length,
      });
    } catch {
      continueLearning.push({
        enrollment_id: enr.id,
        title: enr.title,
        progress_pct: enr.progress_pct,
        type: enr.type,
        focus: null,
        treatments_left: enr.treatment_count,
      });
    }
  }

  const [etCount] = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM ${ENROLLMENT_TREATMENTS_TABLE} et
     JOIN ${ENROLLMENTS_TABLE} e ON e.id = et.enrollment_id
     WHERE e.user_id = $1 AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')`,
    [userId],
  );

  const live = await listStudentLiveClasses(userId);
  const upcomingLive = [
    ...(live.live_now ? [live.live_now] : []),
    ...live.upcoming,
  ]
    .slice(0, 5)
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      starts_at: ev.starts_at,
      ends_at: ev.ends_at,
      course_title: ev.course_title,
      treatment_title: ev.treatment_name,
      platform: ev.platform,
    }));

  return {
    student: {
      full_name: user?.full_name ?? "Student",
      display_name: user?.display_name ?? null,
      email: user?.email ?? "",
    },
    stats: {
      active_courses: active.length,
      treatments: parseInt(
        Array.isArray(etCount) ? etCount[0]?.count ?? "0" : "0",
        10,
      ) || treatmentCount,
      avg_progress_pct: avgProgress,
      total_enrollments: enrollments.length,
    },
    continue_learning: continueLearning,
    enrollments: enrollments.slice(0, 8),
    upcoming_live: upcomingLive,
  };
}

export async function patchStudentProfile(
  userId: string,
  patch: { display_name?: string | null; avatar_url?: string | null },
) {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (patch.display_name !== undefined) {
    fields.push(`display_name = $${i++}`);
    params.push(patch.display_name);
  }
  if (patch.avatar_url !== undefined) {
    fields.push(`avatar_url = $${i++}`);
    params.push(patch.avatar_url);
  }
  if (!fields.length) {
    const [rows] = await db.query(
      `SELECT id, email::text AS email, full_name, display_name, avatar_url, role, is_active
       FROM ${USERS_TABLE} WHERE id = $1`,
      [userId],
    );
    return Array.isArray(rows) ? rows[0] ?? null : null;
  }
  fields.push("updated_at = now()");
  params.push(userId);
  const [rows] = await db.query(
    `UPDATE ${USERS_TABLE}
     SET ${fields.join(", ")}
     WHERE id = $${i} AND role = 'student' AND deleted_at IS NULL
     RETURNING id, email::text AS email, full_name, display_name, avatar_url, role, is_active`,
    params,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
