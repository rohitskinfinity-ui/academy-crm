import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getPublicBlogPostBySlug } from "@/lib/services/public/cmsService";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    await ensureDatabase();
    const { slug } = await context.params;
    const post = await getPublicBlogPostBySlug(slug);
    if (!post) return apiError("Post not found", 404);
    return apiSuccess(post, "OK");
  } catch (err) {
    return handleApiError(err);
  }
}
