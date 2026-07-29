import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  getLiveClassForJoin,
  getLiveClassJoinWindow,
  listEnrolledStudentsForLiveClass,
  resolveEnrolledStudentJoinUrl,
} from "@/lib/services/liveClassJoinService";
import { joinWindowMessage } from "@/lib/liveClassJoinWindow";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET — join window + enrolled student count (meeting_url never returned here
 * for open listing; use POST with user_id or preview).
 */
export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const event = await getLiveClassForJoin(id);
    if (!event) return apiError("Live class not found", 404);

    const window = getLiveClassJoinWindow(event);
    const enrolled = await listEnrolledStudentsForLiveClass(event);

    return apiSuccess(
      {
        ...window,
        title: event.title,
        course_id: event.course_id,
        batch_id: event.batch_id,
        enrolled_count: enrolled.length,
        // Do not expose raw Zoom URL on GET — use enrollment-gated POST
        meeting_url: null,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
      },
      "OK",
    );
  } catch (err) {
    return handleApiError(err);
  }
}

const joinBodySchema = z.object({
  /** Enrolled student — required unless preview=true (admin test only). */
  user_id: z.string().uuid().optional(),
  /** Admin-only: open generic meeting URL without enrollment (testing). */
  preview: z.boolean().optional(),
  mark_attendance: z.boolean().optional(),
});

/**
 * POST — enrollment-gated join.
 * - Student path: user_id must be enrolled → personal Zoom registrant URL
 * - Admin preview: preview=true → generic meeting_url (no attendance)
 */
export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const event = await getLiveClassForJoin(id);
    if (!event) return apiError("Live class not found", 404);

    const body = joinBodySchema.parse(await request.json().catch(() => ({})));
    const window = getLiveClassJoinWindow(event);

    if (!window.can_join) {
      return apiError(joinWindowMessage(window.reason), 403, {
        ...window,
        meeting_url: null,
      });
    }

    // Admin preview / host testing — not for students
    if (body.preview && !body.user_id) {
      return apiSuccess(
        {
          ...window,
          meeting_url: event.meeting_url,
          title: event.title,
          attendance_marked: false,
          preview: true,
        },
        "Admin preview join",
      );
    }

    if (!body.user_id) {
      return apiError(
        "Student user_id is required for enrollment-gated join. Use preview:true only for admin testing.",
        400,
      );
    }

    const result = await resolveEnrolledStudentJoinUrl({
      event,
      userId: body.user_id,
      markAttendance: body.mark_attendance !== false,
    });

    if (!result.ok) {
      const messages: Record<string, string> = {
        not_enrolled:
          "This student is not enrolled in this course / batch — join denied.",
        no_email: "Student has no email on file — cannot create Zoom registrant.",
        not_started: joinWindowMessage("not_started"),
        ended: joinWindowMessage("ended"),
        cancelled: joinWindowMessage("cancelled"),
        no_url: joinWindowMessage("no_url"),
      };
      return apiError(messages[result.reason] || "Join denied", 403, {
        ...window,
        reason: result.reason,
        meeting_url: null,
      });
    }

    return apiSuccess(
      {
        ...window,
        meeting_url: result.meeting_url,
        title: event.title,
        attendance_marked: result.attendance_marked,
        enrollment_gated: true,
      },
      result.attendance_marked
        ? "Enrolled student join — attendance marked"
        : "Enrolled student join",
    );
  } catch (err) {
    return handleApiError(err);
  }
}
