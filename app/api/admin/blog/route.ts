import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createBlogPost,
  listBlogCategories,
  listBlogPosts,
} from "@/lib/services/admin/blogService";
import {
  createBlogPostSchema,
  listBlogQuerySchema,
} from "@/lib/validations/admin/blog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
    if (sp.meta === "categories") {
      return apiSuccess(await listBlogCategories(), "OK");
    }
    const query = listBlogQuerySchema.parse(sp);
    return apiSuccess(await listBlogPosts(query), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createBlogPostSchema.parse(await request.json());
    const created = await createBlogPost(body);
    return apiSuccess(created, "Blog post created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
