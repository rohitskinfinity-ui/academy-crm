import { db } from "@/lib/db";
import {
  ENROLLMENT_TREATMENT_STAGES_TABLE,
  ENROLLMENT_TREATMENTS_TABLE,
  ENROLLMENTS_TABLE,
  TREATMENT_VIDEOS_TABLE,
} from "@/lib/db/schema";

export type StudentEnrollmentAccess = {
  enrollment_id: string;
  enrollment_treatment_id: string;
  treatment_id: string;
  user_id: string;
  status: string;
  progress_pct: number;
};

export async function getOwnedEnrollment(
  userId: string,
  enrollmentId: string,
) {
  const [rows] = await db.query<{
    id: string;
    user_id: string;
    status: string;
    progress_pct: number;
    title: string;
    course_id: string | null;
    workshop_id: string | null;
  }>(
    `SELECT id, user_id, status::text AS status, progress_pct::float8 AS progress_pct,
            title, course_id, workshop_id
     FROM ${ENROLLMENTS_TABLE}
     WHERE id = $1
       AND user_id = $2
       AND deleted_at IS NULL
       AND status IN ('active', 'completed')
     LIMIT 1`,
    [enrollmentId, userId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function getEnrollmentTreatmentAccess(
  userId: string,
  enrollmentId: string,
  treatmentId: string,
): Promise<StudentEnrollmentAccess | null> {
  const [rows] = await db.query<StudentEnrollmentAccess>(
    `SELECT e.id AS enrollment_id,
            et.id AS enrollment_treatment_id,
            et.treatment_id,
            e.user_id,
            e.status::text AS status,
            e.progress_pct::float8 AS progress_pct
     FROM ${ENROLLMENTS_TABLE} e
     JOIN ${ENROLLMENT_TREATMENTS_TABLE} et
       ON et.enrollment_id = e.id AND et.treatment_id = $3
     WHERE e.id = $1
       AND e.user_id = $2
       AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')
     LIMIT 1`,
    [enrollmentId, userId, treatmentId],
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function assertStageUnlocked(
  enrollmentTreatmentId: string,
  stage: string,
) {
  const [rows] = await db.query<{ status: string }>(
    `SELECT status::text AS status
     FROM ${ENROLLMENT_TREATMENT_STAGES_TABLE}
     WHERE enrollment_treatment_id = $1 AND stage = $2
     LIMIT 1`,
    [enrollmentTreatmentId, stage],
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) {
    throw Object.assign(new Error("Stage not found for this enrollment"), {
      status: 404,
    });
  }
  if (row.status === "locked") {
    throw Object.assign(new Error("This stage is locked"), { status: 403 });
  }
  return row.status;
}

export async function resolveVideoAccess(userId: string, videoId: string) {
  const [rows] = await db.query<{
    video_id: string;
    treatment_id: string;
    stage: string;
    title: string;
    duration_seconds: number | null;
    video_url: string | null;
    thumbnail_url: string | null;
    enrollment_id: string;
    enrollment_treatment_id: string;
    stage_status: string;
  }>(
    `SELECT tv.id AS video_id,
            tv.treatment_id,
            tv.stage::text AS stage,
            tv.title,
            tv.duration_seconds,
            tv.video_url,
            tv.thumbnail_url,
            e.id AS enrollment_id,
            et.id AS enrollment_treatment_id,
            ets.status::text AS stage_status
     FROM ${TREATMENT_VIDEOS_TABLE} tv
     JOIN ${ENROLLMENT_TREATMENTS_TABLE} et ON et.treatment_id = tv.treatment_id
     JOIN ${ENROLLMENTS_TABLE} e ON e.id = et.enrollment_id
     LEFT JOIN ${ENROLLMENT_TREATMENT_STAGES_TABLE} ets
       ON ets.enrollment_treatment_id = et.id AND ets.stage = tv.stage
     WHERE tv.id = $1
       AND tv.deleted_at IS NULL
       AND tv.is_published = true
       AND e.user_id = $2
       AND e.deleted_at IS NULL
       AND e.status IN ('active', 'completed')
     ORDER BY e.created_at DESC
     LIMIT 1`,
    [videoId, userId],
  );

  const access = Array.isArray(rows) ? rows[0] ?? null : null;
  if (!access) {
    throw Object.assign(new Error("Video not found or not enrolled"), {
      status: 404,
    });
  }
  if (access.stage_status === "locked") {
    throw Object.assign(new Error("This stage is locked"), { status: 403 });
  }
  if (!access.video_url) {
    throw Object.assign(new Error("Video file not available"), { status: 404 });
  }
  return access;
}
