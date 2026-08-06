import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { addInquiryComment } from "@/lib/services/admin/inquiryService";
import { z } from "zod";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    const { user } = await requireAdmin(request);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const comment = await addInquiryComment(id, payload.body, user.id);
    return apiSuccess(comment, "Comment added", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
