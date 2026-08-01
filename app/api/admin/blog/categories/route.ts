import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createBlogCategory,
  listBlogCategories,
} from "@/lib/services/admin/blogService";
import { createBlogCategorySchema } from "@/lib/validations/admin/blog";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    return apiSuccess(await listBlogCategories(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createBlogCategorySchema.parse(await request.json());
    const created = await createBlogCategory(body);
    return apiSuccess(created, "Category created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
