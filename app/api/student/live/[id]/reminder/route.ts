import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireStudent } from "@/lib/auth/student";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { setStudentLiveReminder } from "@/lib/services/student/liveClassService";
import { liveReminderSchema } from "@/lib/validations/student/lms";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireStudent(request);
    const { id } = await context.params;
    let body: { reminded?: boolean } = {};
    try {
      body = liveReminderSchema.parse(await request.json());
    } catch {
      body = {};
    }
    const data = await setStudentLiveReminder(user.id, id, body.reminded);
    return apiSuccess(data, data.reminded ? "Reminder set" : "Reminder cleared");
  } catch (err) {
    return handleApiError(err);
  }
}
