import { NextRequest } from "next/server";
import { ensureDatabase } from "@/lib/db/bootstrap";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { adminLogin } from "@/lib/services/admin/authService";
import { loginSchema } from "@/lib/validations/admin/auth";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabase();
    const body = loginSchema.parse(await request.json());
    const result = await adminLogin(body.email, body.password);
    return apiSuccess(result, "Login successful");
  } catch (err) {
    return handleApiError(err);
  }
}
