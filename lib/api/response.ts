import { NextResponse } from "next/server";
import { AuthError } from "@/lib/auth/admin";
import { ZodError } from "zod";

export function apiSuccess<T>(
  data: T,
  message = "OK",
  status = 200,
) {
  return NextResponse.json(
    { success: true, message, data },
    { status },
  );
}

export function apiError(
  message: string,
  status = 400,
  errors?: unknown,
) {
  return NextResponse.json(
    { success: false, message, errors: errors ?? null },
    { status },
  );
}

export function isHttpError(
  err: unknown,
): err is Error & { status: number } {
  return (
    err instanceof Error &&
    typeof (err as Error & { status?: unknown }).status === "number"
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return apiError(err.message, err.status);
  }
  if (isHttpError(err)) {
    return apiError(err.message, err.status);
  }
  if (err instanceof ZodError) {
    return apiError("Validation failed", 400, err.flatten());
  }
  console.error("[api]", err);
  const message =
    err instanceof Error ? err.message : "Internal server error";
  return apiError(message, 500);
}
