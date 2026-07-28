import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  createCategory,
  listCategories,
} from "@/lib/services/admin/courseService";
import { createCategorySchema } from "@/lib/validations/admin/course";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    return apiSuccess(await listCategories(), "OK");
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    await requireAdmin(request);
    const body = createCategorySchema.parse(await request.json());
    return apiSuccess(await createCategory(body), "Category created", 201);
  } catch (err) {
    return handleApiError(err);
  }
}
