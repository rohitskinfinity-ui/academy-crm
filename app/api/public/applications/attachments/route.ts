import { NextRequest } from "next/server";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import {
  buildEnrollmentAttachmentPath,
  uploadFileToGcp,
} from "@/lib/gcp/storage";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_PHOTO = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_DOC = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function uploadSessionId() {
  const year = new Date().getFullYear();
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `SA-${year}-${suffix}`;
}

async function savePart(
  file: File,
  kind: "photo" | "documents",
  registrationId: string,
  allowed: Set<string>,
) {
  if (file.size <= 0) {
    throw Object.assign(new Error(`${kind} file is empty`), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    throw Object.assign(new Error(`${kind} exceeds 8MB limit`), { status: 400 });
  }
  const contentType = file.type || "application/octet-stream";
  if (!allowed.has(contentType)) {
    throw Object.assign(
      new Error(
        kind === "photo"
          ? "Photo must be JPEG, PNG, WebP, or GIF"
          : "Document must be PDF or an image",
      ),
      { status: 400 },
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const destination = buildEnrollmentAttachmentPath({
    registrationId,
    kind,
    fileName: file.name || `${kind}.bin`,
  });
  const uploaded = await uploadFileToGcp({
    buffer,
    destination,
    contentType,
    bucket: "public",
  });
  return uploaded.url;
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const photo = form.get("photo");
    const document = form.get("document");

    if (!(photo instanceof File) && !(document instanceof File)) {
      throw Object.assign(
        new Error("Provide a photo and/or qualification document file"),
        { status: 400 },
      );
    }

    const registrationId = uploadSessionId();
    let photo_url: string | null = null;
    let document_url: string | null = null;

    if (photo instanceof File && photo.size > 0) {
      photo_url = await savePart(photo, "photo", registrationId, ALLOWED_PHOTO);
    }
    if (document instanceof File && document.size > 0) {
      document_url = await savePart(
        document,
        "documents",
        registrationId,
        ALLOWED_DOC,
      );
    }

    return apiSuccess(
      {
        registration_id: registrationId,
        photo_url,
        document_url,
      },
      "Attachments uploaded",
    );
  } catch (err) {
    return handleApiError(err);
  }
}
