import path from "path";
import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = process.env.GCP_BUCKET_NAME || "academy-bucket-prod";

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
    .replace(/[^a-z0-9._-]/g, "_");
  const timestamp = Date.now();
  const nameWithTimestamp = `${timestamp}_${sanitizedFileName}`;

  if (options.category === "image") {
    return `treatments/${options.treatmentId}/image/${nameWithTimestamp}`;
  }

  const stageFolder = options.stage || "theory";
  return `treatments/${options.treatmentId}/${options.category}/${stageFolder}/${nameWithTimestamp}`;
}

/**
 * Path for live-class Zoom recordings (not master treatment library media).
 * live-classes/{treatmentId}/{eventId}/{timestamp}_recording.mp4
 */
export function buildLiveClassRecordingPath(options: {
  treatmentId: string;
  eventId: string;
  fileName?: string;
}): string {
  const base = (options.fileName || "recording.mp4")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_");
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
}): Promise<{ url: string; path: string }> {
  const { pipeline } = await import("node:stream/promises");
  const storage = getStorageClient();
  const bucket = storage.bucket(BUCKET_NAME);
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

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${input.destination}`;
  return {
    url: publicUrl,
    path: input.destination,
  };
}

/**
 * Uploads a file buffer directly to GCP Cloud Storage bucket (academy-bucket-prod)
 */
export async function uploadFileToGcp(input: {
  buffer: Buffer;
  destination: string;
  contentType: string;
}): Promise<{ url: string; path: string }> {
  const storage = getStorageClient();
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(input.destination);

  await file.save(input.buffer, {
    contentType: input.contentType,
    metadata: {
      cacheControl: "public, max-age=31536000",
    },
    // Small files: non-resumable is fine; prefer streamUploadToGcp for large videos
    resumable: input.buffer.length > 5 * 1024 * 1024,
  });

  try {
    await file.makePublic();
  } catch {
    // Uniform bucket-level access enabled on private bucket
  }

  const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${input.destination}`;
  return {
    url: publicUrl,
    path: input.destination,
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

  // If already data URL or blob, return unchanged
  if (pathOrUrl.startsWith("data:") || pathOrUrl.startsWith("blob:")) {
    return pathOrUrl;
  }

  // Extract relative storage path
  let relativePath = pathOrUrl;
  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  if (pathOrUrl.startsWith(prefix)) {
    relativePath = pathOrUrl.replace(prefix, "");
  } else if (pathOrUrl.startsWith("https://storage.googleapis.com/")) {
    const parts = pathOrUrl.replace("https://storage.googleapis.com/", "").split("/");
    parts.shift(); // remove bucket name
    relativePath = parts.join("/");
  }

  try {
    const storage = getStorageClient();
    const file = storage.bucket(BUCKET_NAME).file(relativePath);
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return signedUrl;
  } catch (err) {
    console.error("[GCP] Failed to generate signed URL for path:", relativePath, err);
    return pathOrUrl;
  }
}
