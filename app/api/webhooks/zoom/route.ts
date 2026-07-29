import { NextRequest, NextResponse } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import {
  findLiveClassByMeetingId,
  findUserIdByEmail,
  markLiveAttendanceOnJoin,
} from "@/lib/services/liveClassJoinService";
import {
  enqueueFromZoomRecordingCompleted,
  markLiveClassMeetingEnded,
} from "@/lib/services/admin/liveClassRecordingService";
import {
  getZoomWebhookSecret,
  verifyZoomWebhookSignature,
  zoomUrlValidationResponse,
  type ZoomWebhookBody,
} from "@/lib/zoom/webhook";

/**
 * Zoom Event Subscriptions webhook.
 * recording.completed enqueues a durable Postgres job (worker streams Zoom→GCP).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let body: ZoomWebhookBody;
  try {
    body = JSON.parse(rawBody) as ZoomWebhookBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  if (body.event === "endpoint.url_validation") {
    const plainToken = body.payload?.plainToken;
    if (!plainToken || !getZoomWebhookSecret()) {
      return NextResponse.json(
        { message: "ZOOM_SECRET_TOKEN not configured" },
        { status: 500 },
      );
    }
    return NextResponse.json(zoomUrlValidationResponse(plainToken));
  }

  const signature = request.headers.get("x-zm-signature");
  const timestamp = request.headers.get("x-zm-request-timestamp");
  if (
    !verifyZoomWebhookSignature({
      signature,
      timestamp,
      rawBody,
    })
  ) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  try {
    await ensureDatabase();

    if (body.event === "meeting.participant_joined") {
      await handleParticipantJoined(body);
    } else if (body.event === "meeting.ended") {
      const meetingId =
        body.payload?.object?.id != null
          ? String(body.payload.object.id)
          : "";
      if (meetingId) await markLiveClassMeetingEnded(meetingId);
    } else if (body.event === "recording.completed") {
      const queued = await enqueueFromZoomRecordingCompleted(
        body.payload || {},
      );
      console.info(
        `[Zoom webhook] recording.completed queued=${queued?.recording_id ?? "none"} enqueued=${queued?.enqueued ?? false}`,
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[Zoom webhook] handler error", err);
    return NextResponse.json({ status: "error_logged" });
  }
}

async function handleParticipantJoined(body: ZoomWebhookBody) {
  const obj = body.payload?.object;
  const meetingId = obj?.id != null ? String(obj.id) : "";
  const email = obj?.participant?.email?.trim() || "";
  const joinTime = obj?.participant?.join_time;

  if (!meetingId) {
    console.warn("[Zoom webhook] participant_joined without meeting id");
    return;
  }

  const event = await findLiveClassByMeetingId(meetingId);
  if (!event) {
    console.info(
      `[Zoom webhook] No live class for meeting ${meetingId} — skipped`,
    );
    return;
  }

  if (!email) {
    console.info(
      `[Zoom webhook] Participant joined ${meetingId} without email (guest) — skipped`,
    );
    return;
  }

  const userId = await findUserIdByEmail(email);
  if (!userId) {
    console.info(
      `[Zoom webhook] No CRM user for email ${email} — skipped attendance`,
    );
    return;
  }

  const result = await markLiveAttendanceOnJoin({
    event,
    userId,
    checkedInAt: joinTime,
  });

  console.info(
    `[Zoom webhook] attendance event=${event.id} user=${userId} marked=${result.marked} reason=${result.reason}`,
  );
}
