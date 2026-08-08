import type { z } from "zod";
import { db } from "@/lib/db";
import {
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  STUDENT_PROFILES_TABLE,
  USERS_TABLE,
} from "@/lib/db/schema";
import { syncEnrollmentProgress } from "@/lib/services/admin/completionService";
import { getStudentMe } from "@/lib/services/public/studentAuthService";
import { patchProfileSchema } from "@/lib/validations/student/lms";
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
  patch: z.infer<typeof patchProfileSchema>,
) {
  const userFields: string[] = [];
  const userParams: unknown[] = [];
  let i = 1;
  if (patch.full_name !== undefined) {
    userFields.push(`full_name = $${i++}`);
    userParams.push(patch.full_name.trim());
  }
  if (patch.display_name !== undefined) {
    userFields.push(`display_name = $${i++}`);
    userParams.push(patch.display_name);
  }
  if (patch.avatar_url !== undefined) {
    userFields.push(`avatar_url = $${i++}`);
    userParams.push(patch.avatar_url);
  }
  if (userFields.length > 0) {
    userFields.push("updated_at = now()");
    userParams.push(userId);
    await db.query(
      `UPDATE ${USERS_TABLE}
       SET ${userFields.join(", ")}
       WHERE id = $${i} AND role = 'student' AND deleted_at IS NULL`,
      userParams,
    );
  }

  const profileKeys = [
    "phone",
    "whatsapp",
    "alternate_phone",
    "location",
    "address_line",
    "city_state",
    "pin_code",
    "date_of_birth",
    "gender",
    "guardian_name",
    "highest_qualification",
    "profession",
    "medical_background",
    "currently_working",
    "registration_no",
    "program_label",
  ] as const;

  const profilePatch: Record<string, unknown> = {};
  for (const key of profileKeys) {
    if (patch[key] !== undefined) {
      profilePatch[key] = patch[key];
    }
  }

  if (Object.keys(profilePatch).length > 0) {
    const cols = Object.keys(profilePatch);
    const vals = Object.values(profilePatch);
    const insertCols = ["user_id", ...cols].join(", ");
    const insertPlaceholders = [
      "$1",
      ...cols.map((_, idx) => `$${idx + 2}`),
    ].join(", ");
    const updates = cols.map((col, idx) => `${col} = $${idx + 2}`).join(", ");

    await db.query(
      `INSERT INTO ${STUDENT_PROFILES_TABLE} (${insertCols})
       VALUES (${insertPlaceholders})
       ON CONFLICT (user_id) DO UPDATE SET
         ${updates},
         updated_at = now()`,
      [userId, ...vals],
    );
  }

  return getStudentMe(userId);
}
