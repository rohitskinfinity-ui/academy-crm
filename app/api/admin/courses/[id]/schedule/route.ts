import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  createManualHandsOnDay,
  createManualLiveClass,
  createWeeklyLiveSeries,
  fillRemainingLiveSessions,
  generatePGDCCHandsOnSchedule,
  getCourseBatches,
  getModuleScheduleBoard,
  listCourseSchedule,
  softDeleteScheduleEvent,
} from "@/lib/services/admin/schedulingService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const weeklySeriesSchema = z.object({
  batch_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  platform: z.enum(["zoom", "google_meet"]).default("zoom"),
  meeting_url: z.string().min(1),
  instructor_name: z.string().min(1),
  starts_at: z.string().min(1),
  duration_minutes: z.number().int().min(15).default(60),
  recurrence_rule: z.string().min(1),
  recurrence_until: z.string().min(1),
  treatment_ids: z.array(z.string().uuid()).min(1),
});

const handsOnSchema = z.object({
  batch_id: z.string().uuid().nullable().optional(),
  campus_id: z.string().uuid().nullable().optional(),
  start_date: z.string().min(1),
  treatment_ids: z.array(z.string().uuid()).min(1),
  day_interval: z.number().int().min(1).default(7),
});

const manualLiveSchema = z.object({
  treatment_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  platform: z.enum(["zoom", "google_meet"]).default("zoom"),
  meeting_url: z.string().min(1),
  host_start_url: z.string().nullable().optional(),
  meeting_id: z.string().nullable().optional(),
  passcode: z.string().nullable().optional(),
  instructor_name: z.string().default("Senior Faculty Doctor"),
  starts_at: z.string().min(1),
  duration_minutes: z.number().int().min(15).default(60),
});

const manualHandsOnSchema = z.object({
  treatment_id: z.string().uuid(),
  batch_id: z.string().uuid().nullable().optional(),
  campus_id: z.string().uuid().nullable().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  starts_at: z.string().min(1),
  duration_hours: z.number().min(1).default(8),
  venue: z.string().nullable().optional(),
});

const fillRemainingSchema = z.object({
  batch_id: z.string().uuid().nullable().optional(),
  treatment_ids: z.array(z.string().uuid()).min(1),
  starts_at: z.string().min(1),
  gap_days: z.number().int().min(1).default(7),
  duration_minutes: z.number().int().min(15).default(60),
  meeting_url: z.string().min(1),
  platform: z.enum(["zoom", "google_meet"]).default("zoom"),
  instructor_name: z.string().default("Senior Faculty Doctor"),
});

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const batchId = request.nextUrl.searchParams.get("batch_id") ?? undefined;
    const [schedule, batches, modules] = await Promise.all([
      listCourseSchedule(id, batchId),
      getCourseBatches(id),
      getModuleScheduleBoard(id, batchId),
    ]);
    return apiSuccess({ schedule, batches, modules }, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json();
    const action = body.action as string;

    if (action === "manual_live") {
      const input = manualLiveSchema.parse(body);
      const event = await createManualLiveClass({
        ...input,
        course_id: id,
      });
      if (!event) return apiError("Failed to create live class", 500);
      return apiSuccess(event, "Live class scheduled", 201);
    }

    if (action === "manual_hands_on") {
      const input = manualHandsOnSchema.parse(body);
      const event = await createManualHandsOnDay({
        ...input,
        course_id: id,
      });
      if (!event) return apiError("Failed to create hands-on day", 500);
      return apiSuccess(event, "Hands-on day scheduled", 201);
    }

    if (action === "fill_remaining") {
      const input = fillRemainingSchema.parse(body);
      const result = await fillRemainingLiveSessions({
        ...input,
        course_id: id,
      });
      return apiSuccess(
        result,
        `Created ${result.count} remaining live sessions`,
        201,
      );
    }

    if (action === "weekly_series") {
      const input = weeklySeriesSchema.parse(body);
      const result = await createWeeklyLiveSeries({
        ...input,
        course_id: id,
      });
      return apiSuccess(result, `Created ${result.count} live class sessions`, 201);
    }

    if (action === "hands_on_days") {
      const input = handsOnSchema.parse(body);
      const result = await generatePGDCCHandsOnSchedule({
        course_id: id,
        batch_id: input.batch_id,
        campus_id: input.campus_id,
        start_date: input.start_date,
        treatment_ids: input.treatment_ids,
        day_interval: input.day_interval,
      });
      return apiSuccess(
        result,
        `Created ${result.event_ids.length} hands-on days`,
        201,
      );
    }

    return handleApiError(
      Object.assign(
        new Error(
          "Unknown action. Use manual_live, manual_hands_on, fill_remaining, hands_on_days, or weekly_series",
        ),
        { status: 400 },
      ),
    );
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const eventId = request.nextUrl.searchParams.get("event_id");
    if (!eventId) return apiError("event_id query param required", 400);
    const deleted = await softDeleteScheduleEvent(id, eventId);
    if (!deleted) return apiError("Event not found", 404);
    return apiSuccess(deleted, "Event removed");
  } catch (err) {
    return handleApiError(err);
  }
}
