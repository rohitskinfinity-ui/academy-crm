import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import {
  getBlogPostById,
  softDeleteBlogPost,
  updateBlogPost,
} from "@/lib/services/admin/blogService";
import { updateBlogPostSchema } from "@/lib/validations/admin/blog";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const post = await getBlogPostById(id);
    if (!post) return apiError("Blog post not found", 404);
    return apiSuccess(post, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const body = updateBlogPostSchema.parse(await request.json());
    const updated = await updateBlogPost(id, body);
    if (!updated) return apiError("Blog post not found", 404);
    return apiSuccess(updated, "Blog post updated");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(request: NextRequest, context: Ctx) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const { id } = await context.params;
    const deleted = await softDeleteBlogPost(id);
    if (!deleted) return apiError("Blog post not found", 404);
    return apiSuccess(deleted, "Blog post deleted");
  } catch (err) {
    return handleApiError(err);
  }
}
