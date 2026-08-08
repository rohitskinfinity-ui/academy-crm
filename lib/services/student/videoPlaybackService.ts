import { getGcpSignedUrl } from "@/lib/gcp/storage";
import type { StudentUser } from "@/lib/auth/student";
import { resolveVideoAccess } from "./access";
import { db } from "@/lib/db";
import { TREATMENT_BOOKLETS_TABLE } from "@/lib/db/schema";
import { getEnrollmentTreatmentAccess, assertStageUnlocked } from "./access";

const PLAYBACK_TTL_MINUTES = 10;

export async function issueVideoPlayback(
  user: StudentUser,
  videoId: string,
) {
  const access = await resolveVideoAccess(user.id, videoId);
  const expiresAt = new Date(
    Date.now() + PLAYBACK_TTL_MINUTES * 60 * 1000,
  ).toISOString();
  const playbackUrl = await getGcpSignedUrl(
    access.video_url,
    PLAYBACK_TTL_MINUTES,
  );

  console.info(
    JSON.stringify({
      event: "student_video_playback",
      user_id: user.id,
      video_id: videoId,
      enrollment_id: access.enrollment_id,
      expires_at: expiresAt,
    }),
  );

  return {
    playback_url: playbackUrl,
    expires_at: expiresAt,
    expires_in_seconds: PLAYBACK_TTL_MINUTES * 60,
    watermark: {
      name: user.display_name || user.full_name,
      email: user.email,
    },
    video: {
      id: access.video_id,
      title: access.title,
      duration_seconds: access.duration_seconds,
      stage: access.stage,
      treatment_id: access.treatment_id,
      enrollment_id: access.enrollment_id,
      enrollment_treatment_id: access.enrollment_treatment_id,
    },
  };
}

export async function issueBookletDownload(
  user: StudentUser,
  enrollmentId: string,
  bookletId: string,
) {
  const [rows] = await db.query<{
    id: string;
    name: string;
    treatment_id: string;
    stage: string;
    file_url: string | null;
  }>(
    `SELECT id, name, treatment_id, stage::text AS stage, file_url
     FROM ${TREATMENT_BOOKLETS_TABLE}
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [bookletId],
  );
  const booklet = Array.isArray(rows) ? rows[0] : null;
  if (!booklet?.file_url) {
    throw Object.assign(new Error("Booklet not found"), { status: 404 });
  }

  const access = await getEnrollmentTreatmentAccess(
    user.id,
    enrollmentId,
    booklet.treatment_id,
  );
  if (!access) {
    throw Object.assign(new Error("Not enrolled for this booklet"), {
      status: 403,
    });
  }
  await assertStageUnlocked(access.enrollment_treatment_id, booklet.stage);

  const expiresAt = new Date(
    Date.now() + PLAYBACK_TTL_MINUTES * 60 * 1000,
  ).toISOString();
  const url = await getGcpSignedUrl(booklet.file_url, PLAYBACK_TTL_MINUTES);

  return {
    url,
    expires_at: expiresAt,
    booklet: { id: booklet.id, name: booklet.name, stage: booklet.stage },
  };
}
