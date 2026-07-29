import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { listApplications } from "@/lib/services/admin/applicationService";
import { z } from "zod";

const listQuerySchema = z.object({
  status: z.string().optional(),
  course_id: z.string().uuid().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const params = listQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await listApplications(params);
    return apiSuccess(result, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
