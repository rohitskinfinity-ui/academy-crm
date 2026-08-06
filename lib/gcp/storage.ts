import path from "path";
import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCP_BUCKET_NAME || "academy-bucket-prod";
const PUBLIC_BUCKET_NAME =
  process.env.GCP_PUBLIC_BUCKET_NAME || "academy-bucket-public-prod";

function getStorageClient(): Storage {
  const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFilePath) {
    const absoluteKeyPath = path.isAbsolute(keyFilePath)
      ? keyFilePath
      : path.join(process.cwd(), keyFilePath);
    return new Storage({ keyFilename: absoluteKeyPath });
  }
  return new Storage();
}

function resolveBucketName(bucket?: string | null): string {
  if (bucket === "public" || bucket === PUBLIC_BUCKET_NAME) {
    return PUBLIC_BUCKET_NAME;
  }
  return BUCKET_NAME;
}

/**
 * Builds structured GCP storage path
 */
export function buildGcpStoragePath(options: {
  treatmentId: string;
  category: "image" | "videos" | "booklets" | "thumbnails";
  stage?: string;
  fileName: string;
}): string {
  const sanitizedFileName = options.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  const nameWithTimestamp = `${timestamp}_${sanitizedFileName}`;

  if (options.category === "image") {
    return `treatments/${options.treatmentId}/image/${nameWithTimestamp}`;
  }

  const stageFolder = options.stage || "theory";
  return `treatments/${options.treatmentId}/${options.category}/${stageFolder}/${nameWithTimestamp}`;
}

/**
 * Path for testimonial media (videos / thumbnails) in the public bucket.
 * testimonials/{id}/videos/{timestamp}_file.mp4
 */
export function buildTestimonialMediaPath(options: {
  testimonialId: string;
  kind: "videos" | "thumbnails" | "image";
  fileName: string;
}): string {
  const sanitizedFileName = options.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  const folder =
    options.kind === "videos"
      ? "videos"
      : options.kind === "thumbnails"
        ? "thumbnails"
        : "image";
  return `testimonials/${options.testimonialId}/${folder}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Path for course cover / gallery media in the public bucket.
 * courses/{id}/image|images|videos|thumbnails/{timestamp}_file
 */
export function buildCourseMediaPath(options: {
  courseId: string;
  kind: "image" | "images" | "videos" | "thumbnails";
  fileName: string;
}): string {
  const sanitizedFileName = options.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  return `courses/${options.courseId}/${options.kind}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Path for workshop media in the public bucket.
 * workshops/{id}/image|procedures/{timestamp}_file
 */
export function buildWorkshopMediaPath(options: {
  workshopId: string;
  kind: "image" | "procedures";
  fileName: string;
}): string {
  const sanitizedFileName = options.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  return `workshops/${options.workshopId}/${options.kind}/${timestamp}_${sanitizedFileName}`;
}

/**
 * Path for enrollment application attachments (photo / qualification docs).
 * applications/{registrationId}/photo|documents/{timestamp}_file
 */
export function buildEnrollmentAttachmentPath(options: {
  registrationId: string;
  kind: "photo" | "documents";
  fileName: string;
}): string {
  const sanitizedFileName = options.fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  const safeReg = options.registrationId
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  return `applications/${safeReg}/${options.kind}/${timestamp}_${sanitizedFileName}`;
}
export function buildLiveClassRecordingPath(options: {
  treatmentId: string;
  eventId: string;
  fileName?: string;
}): string {
  const base = (options.fileName || "recording.mp4")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_");
  const timestamp = Date.now();
  return `live-classes/${options.treatmentId}/${options.eventId}/${timestamp}_${base}`;
}

/**
 * Stream an incoming readable into GCP (resumable — safe for large Zoom recordings).
 */
export async function streamUploadToGcp(input: {
  readable: NodeJS.ReadableStream;
  destination: string;
  contentType: string;
  bucket?: string;
}): Promise<{ url: string; path: string; bucket: string }> {
  const { pipeline } = await import("node:stream/promises");
  const bucketName = resolveBucketName(input.bucket);
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(input.destination);

  const writeStream = file.createWriteStream({
    resumable: true,
    contentType: input.contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
  });

  await pipeline(input.readable, writeStream);

  try {
    await file.makePublic();
  } catch {
    // Uniform bucket-level access enabled on private bucket
  }

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${input.destination}`;
  return {
    url: publicUrl,
    path: input.destination,
    bucket: bucketName,
  };
}

/**
 * Uploads a file buffer directly to GCP Cloud Storage bucket
 */
export async function uploadFileToGcp(input: {
  buffer: Buffer;
  destination: string;
  contentType: string;
  bucket?: string;
}): Promise<{ url: string; path: string; bucket: string }> {
  const bucketName = resolveBucketName(input.bucket);
  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(input.destination);

  await file.save(input.buffer, {
    contentType: input.contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
    resumable: input.buffer.length > 5 * 1024 * 1024,
  });

  try {
    await file.makePublic();
  } catch {
    // Uniform bucket-level access enabled on private bucket
  }

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${input.destination}`;
  return {
    url: publicUrl,
    path: input.destination,
    bucket: bucketName,
  };
}

/**
 * Generates a signed read URL for private GCP Cloud Storage objects
 */
export async function getGcpSignedUrl(
  pathOrUrl: string | null | undefined,
  expiresInMinutes = 60,
): Promise<string> {
  if (!pathOrUrl) return "";

  if (pathOrUrl.startsWith("data:") || pathOrUrl.startsWith("blob:")) {
    return pathOrUrl;
  }

  let bucketName = BUCKET_NAME;
  let relativePath = pathOrUrl;

  if (pathOrUrl.startsWith("https://storage.googleapis.com/")) {
    const rest = pathOrUrl.replace("https://storage.googleapis.com/", "");
    const slash = rest.indexOf("/");
    if (slash > 0) {
      bucketName = rest.slice(0, slash);
      relativePath = rest.slice(slash + 1);
    }
  }

  try {
    const storage = getStorageClient();
    const file = storage.bucket(bucketName).file(relativePath);
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return signedUrl;
  } catch (err) {
    console.error(
      "[GCP] Failed to generate signed URL for path:",
      relativePath,
      err,
    );
    return pathOrUrl;
  }
}
