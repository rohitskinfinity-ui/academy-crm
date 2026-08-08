import { db } from "@/lib/db";
import { VIDEO_PROGRESS_TABLE } from "@/lib/db/schema";
import { syncEnrollmentProgress } from "@/lib/services/admin/completionService";
import { resolveVideoAccess } from "./access";

export async function upsertVideoProgress(
  userId: string,
  videoId: string,
  input: {
    position_seconds: number;
    watched_percent: number;
    is_completed?: boolean;
  },
) {
  const access = await resolveVideoAccess(userId, videoId);
  const watched = Math.min(100, Math.max(0, Number(input.watched_percent) || 0));
  const position = Math.max(0, Math.floor(Number(input.position_seconds) || 0));
  const completed =
    input.is_completed === true || watched >= 90;

  await db.query(
    `INSERT INTO ${VIDEO_PROGRESS_TABLE}
       (enrollment_treatment_id, video_id, last_position_seconds, watched_percent,
        is_completed, completed_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CASE WHEN $5 THEN now() ELSE NULL END, now())
     ON CONFLICT (enrollment_treatment_id, video_id)
     DO UPDATE SET
       last_position_seconds = GREATEST(${VIDEO_PROGRESS_TABLE}.last_position_seconds, EXCLUDED.last_position_seconds),
       watched_percent = GREATEST(${VIDEO_PROGRESS_TABLE}.watched_percent, EXCLUDED.watched_percent),
       is_completed = ${VIDEO_PROGRESS_TABLE}.is_completed OR EXCLUDED.is_completed,
       completed_at = CASE
         WHEN ${VIDEO_PROGRESS_TABLE}.is_completed OR EXCLUDED.is_completed
         THEN COALESCE(${VIDEO_PROGRESS_TABLE}.completed_at, now())
         ELSE NULL
       END,
       updated_at = now()`,
    [
      access.enrollment_treatment_id,
      videoId,
      position,
      watched,
      completed,
    ],
  );

  const progress = await syncEnrollmentProgress(access.enrollment_id);

  return {
    video_id: videoId,
    enrollment_id: access.enrollment_id,
    last_position_seconds: position,
    watched_percent: watched,
    is_completed: completed,
    enrollment_progress_pct: progress.progress_pct,
  };
}
