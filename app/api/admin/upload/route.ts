import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { buildGcpStoragePath, uploadFileToGcp } from "@/lib/gcp/storage";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return apiError("No file provided", 400);
    }

    const treatmentId = (formData.get("treatmentId") as string) || "general";
    const category = (formData.get("category") as "image" | "videos" | "booklets" | "thumbnails") || "image";
    const stage = (formData.get("stage") as string) || "theory";

    const destination = buildGcpStoragePath({
      treatmentId,
      category,
      stage,
      fileName: file.name,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await uploadFileToGcp({
      buffer,
      destination,
      contentType: file.type || "application/octet-stream",
    });

    return apiSuccess(
      {
        url: result.url,
        path: result.path,
        name: file.name,
        size_bytes: file.size,
        mime_type: file.type,
      },
      "File uploaded successfully",
      201,
    );
  } catch (err) {
    return handleApiError(err);
  }
}
