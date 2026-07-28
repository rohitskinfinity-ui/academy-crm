import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getGcpSignedUrl } from "@/lib/gcp/storage";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const urlParam =
      request.nextUrl.searchParams.get("url") ||
      request.nextUrl.searchParams.get("path");

    if (!urlParam) {
      return apiSuccess({ url: "" });
    }

    const signedUrl = await getGcpSignedUrl(urlParam);
    return apiSuccess({ url: signedUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
