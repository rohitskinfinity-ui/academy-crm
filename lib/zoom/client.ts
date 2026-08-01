import axios from "axios";
import { zoomRecordingErrorFromAxios } from "@/lib/zoom/recordingErrors";

const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID || "rQaoSxxWRQGpxvXF35ipgA";
const ZOOM_CLIENT_ID = process.env.ZOOM_CLIENT_ID || "ueKDmNe9RWaUvWzX5knbEQ";
const ZOOM_CLIENT_SECRET =
  process.env.ZOOM_CLIENT_SECRET || "B3hs3HLD2dmbX7LEY3DvmPkjxM6txptE";

type ZoomTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

type ZoomCreateMeetingOptions = {
  topic: string;
  agenda?: string;
  starts_at: string; // ISO String or Date
  duration_minutes?: number;
  /** When true, Zoom requires registration; only synced registrants get join links. */
  require_registration?: boolean;
};

type ZoomMeetingResult = {
  id: string | number;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
  registration_url?: string;
};

export type ZoomRegistrantInput = {
  email: string;
  first_name: string;
  last_name?: string;
};

export type ZoomRegistrantResult = {
  registrant_id: string;
  join_url: string;
  email: string;
};

function zoomRequireRegistrationDefault(): boolean {
  return process.env.ZOOM_REQUIRE_REGISTRATION !== "false";
}

/**
  Retrieves a Server-to-Server OAuth access token from Zoom OAuth API
 */
export async function getZoomAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  try {
    const response = await axios.post<ZoomTokenResponse>(
      "https://zoom.us/oauth/token",
      null,
      {
        params: {
          grant_type: "account_credentials",
          account_id: ZOOM_ACCOUNT_ID,
        },
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    return response.data.access_token;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const zoomErr = err.response.data as {
        error?: string;
        reason?: string;
        message?: string;
      };
      const reason =
        zoomErr.reason || zoomErr.message || zoomErr.error || "Zoom OAuth failed";
      if (reason.toLowerCase().includes("disabled")) {
        throw new Error(
          "Zoom App is disabled in Zoom Marketplace. Log into marketplace.zoom.us -> select app 'ueKDmNe9RWaUvWzX5knbEQ' -> click 'Activate your app'.",
        );
      }
      throw new Error(`Zoom OAuth error: ${reason}`);
    }
    throw err;
  }
}

/** Zoom account / meeting timezone (IANA). Defaults to India. */
const ZOOM_TIMEZONE =
  process.env.ZOOM_TIMEZONE || "Asia/Kolkata";

/**
 * Format a Date as Zoom local wall-clock time: yyyy-MM-ddTHH:mm:ss (no Z).
 * Must be paired with an explicit `timezone` field so Zoom does not fall back
 * to the OAuth account's profile timezone (often US Pacific).
 */
function formatZoomLocalStart(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  // en-CA can emit "24" for midnight in some engines — normalize to 00
  const hour = get("hour") === "24" ? "00" : get("hour");

  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}`;
}

/**
  Creates a Zoom scheduled meeting via Server-to-Server OAuth API
 */
export async function createZoomMeeting(
  opts: ZoomCreateMeetingOptions,
): Promise<ZoomMeetingResult> {
  const token = await getZoomAccessToken();
  const start = new Date(opts.starts_at);
  const startTime = formatZoomLocalStart(start, ZOOM_TIMEZONE);
  const requireRegistration =
    opts.require_registration ?? zoomRequireRegistrationDefault();

  try {
    const response = await axios.post<ZoomMeetingResult>(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: opts.topic,
        type: 2, // Scheduled Meeting
        start_time: startTime,
        timezone: ZOOM_TIMEZONE,
        duration: opts.duration_minutes || 60,
        agenda:
          opts.agenda || "Skinfinity Academy Weekly Doctor Connect Live Class",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          jbh_time: 0,
          waiting_room: true,
          mute_upon_entry: true,
          watermark: true,
          auto_recording: "cloud",
          // 0 = auto-approve registrants added via API / form
          // 2 = no registration (open link)
          approval_type: requireRegistration ? 0 : 2,
          ...(requireRegistration
            ? {
                registration_type: 1,
                registrants_confirmation_email: false,
                registrants_email_notification: false,
              }
            : {}),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const zoomErr = err.response.data as { message?: string; error?: string };
      throw new Error(
        `Zoom Meeting creation failed: ${
          zoomErr.message || zoomErr.error || "API error"
        }`,
      );
    }
    throw err;
  }
}

/**
 * Add (or fetch) a meeting registrant. Returns their unique join URL.
 */
export async function addZoomMeetingRegistrant(
  meetingId: string,
  registrant: ZoomRegistrantInput,
): Promise<ZoomRegistrantResult> {
  const token = await getZoomAccessToken();
  const id = meetingId.replace(/\s+/g, "");
  const email = registrant.email.trim().toLowerCase();
  const first =
    registrant.first_name.trim() || email.split("@")[0] || "Student";
  const last = (registrant.last_name || "Student").trim() || "Student";

  try {
    const response = await axios.post<{
      registrant_id: string;
      join_url: string;
      email?: string;
    }>(
      `https://api.zoom.us/v2/meetings/${id}/registrants`,
      {
        email,
        first_name: first.slice(0, 64),
        last_name: last.slice(0, 64),
        auto_approve: true,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    return {
      registrant_id: response.data.registrant_id,
      join_url: response.data.join_url,
      email: response.data.email || email,
    };
  } catch (err) {
    // Already registered → look up existing registrant join URL
    if (axios.isAxiosError(err) && err.response?.status === 400) {
      const existing = await findZoomRegistrantByEmail(id, email);
      if (existing) return existing;
    }
    if (axios.isAxiosError(err) && err.response?.data) {
      const zoomErr = err.response.data as { message?: string; error?: string };
      throw new Error(
        `Zoom add registrant failed: ${
          zoomErr.message || zoomErr.error || "API error"
        }`,
      );
    }
    throw err;
  }
}

async function findZoomRegistrantByEmail(
  meetingId: string,
  email: string,
): Promise<ZoomRegistrantResult | null> {
  const token = await getZoomAccessToken();
  const normalized = email.trim().toLowerCase();
  let nextPageToken: string | undefined;

  do {
    const response = await axios.get<{
      registrants?: Array<{
        id?: string;
        registrant_id?: string;
        email?: string;
        join_url?: string;
      }>;
      next_page_token?: string;
    }>(`https://api.zoom.us/v2/meetings/${meetingId}/registrants`, {
      params: {
        page_size: 100,
        status: "approved",
        ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    const match = (response.data.registrants || []).find(
      (r) => (r.email || "").toLowerCase() === normalized && r.join_url,
    );
    if (match?.join_url) {
      return {
        registrant_id: match.registrant_id || match.id || "",
        join_url: match.join_url,
        email: match.email || normalized,
      };
    }
    nextPageToken = response.data.next_page_token || undefined;
  } while (nextPageToken);

  return null;
}

/**
 * Build a fresh Zoom host start URL using a short-lived ZAK token.
 * Prefer this over the create-meeting start_url (which expires quickly).
 */
export async function getZoomHostStartUrl(meetingId: string): Promise<string> {
  const token = await getZoomAccessToken();
  const id = meetingId.replace(/\s+/g, "");

  try {
    const response = await axios.get<{ token: string }>(
      "https://api.zoom.us/v2/users/me/token",
      {
        params: { type: "zak" },
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    const zak = response.data.token;
    if (!zak) {
      throw new Error("Zoom did not return a host ZAK token");
    }

    return `https://zoom.us/s/${id}?zak=${encodeURIComponent(zak)}`;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const zoomErr = err.response.data as { message?: string; error?: string };
      throw new Error(
        `Zoom host start failed: ${
          zoomErr.message || zoomErr.error || "API error"
        }`,
      );
    }
    throw err;
  }
}

export type ZoomRecordingFile = {
  id: string;
  meeting_id: string;
  recording_start?: string;
  recording_end?: string;
  file_type: string;
  file_extension?: string;
  file_size?: number;
  download_url: string;
  play_url?: string;
  recording_type?: string;
  status?: string;
};

export type ZoomMeetingRecordings = {
  uuid?: string;
  id: string | number;
  account_id?: string;
  host_id?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  total_size?: number;
  recording_count?: number;
  recording_files?: ZoomRecordingFile[];
  download_access_token?: string;
};

/**
 * Fetch cloud recording metadata for a meeting.
 * GET /meetings/{meetingId}/recordings
 */
export async function getZoomMeetingRecordings(
  meetingId: string,
): Promise<ZoomMeetingRecordings> {
  const token = await getZoomAccessToken();
  const id = meetingId.replace(/\s+/g, "");

  try {
    const response = await axios.get<ZoomMeetingRecordings>(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(id)}/recordings`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data;
  } catch (err) {
    throw zoomRecordingErrorFromAxios(err);
  }
}

export type ZoomUserRecordingsMeeting = ZoomMeetingRecordings & {
  host_email?: string;
};

export type ZoomUserRecordingsPage = {
  from?: string;
  to?: string;
  page_count?: number;
  page_size?: number;
  total_records?: number;
  next_page_token?: string;
  meetings?: ZoomUserRecordingsMeeting[];
};

/**
 * List cloud recordings for a Zoom user (paginated).
 * GET /users/{userId}/recordings?from=&to=
 */
export async function listZoomUserRecordings(opts: {
  from: string;
  to: string;
  userId?: string;
  pageSize?: number;
}): Promise<ZoomUserRecordingsMeeting[]> {
  const token = await getZoomAccessToken();
  const userId =
    opts.userId ||
    process.env.ZOOM_RECORDINGS_USER_ID?.trim() ||
    "me";
  const pageSize = Math.min(300, Math.max(1, opts.pageSize ?? 30));

  const meetings: ZoomUserRecordingsMeeting[] = [];
  let nextPageToken: string | undefined;

  do {
    try {
      const response = await axios.get<ZoomUserRecordingsPage>(
        `https://api.zoom.us/v2/users/${encodeURIComponent(userId)}/recordings`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            from: opts.from,
            to: opts.to,
            page_size: pageSize,
            ...(nextPageToken ? { next_page_token: nextPageToken } : {}),
          },
        },
      );
      const page = response.data;
      if (Array.isArray(page.meetings)) {
        meetings.push(...page.meetings);
      }
      nextPageToken = page.next_page_token?.trim() || undefined;
    } catch (err) {
      throw zoomRecordingErrorFromAxios(err);
    }
  } while (nextPageToken);

  return meetings;
}

/** Prefer shared screen with speaker MP4, then any MP4. */
export function pickPrimaryZoomRecordingFile(
  files: ZoomRecordingFile[] | undefined,
): ZoomRecordingFile | null {
  if (!files?.length) return null;
  const mp4 = files.filter(
    (f) =>
      (f.file_type || "").toUpperCase() === "MP4" ||
      (f.file_extension || "").toLowerCase() === "mp4",
  );
  if (!mp4.length) return files[0] ?? null;
  const preferred = mp4.find((f) =>
    (f.recording_type || "")
      .toLowerCase()
      .includes("shared_screen_with_speaker"),
  );
  return preferred || mp4[0] || null;
}

/**
 * Open a streaming download from Zoom (do not buffer entire file in memory).
 */
export async function openZoomRecordingDownloadStream(
  downloadUrl: string,
  downloadAccessToken?: string,
): Promise<{ stream: NodeJS.ReadableStream; contentType: string }> {
  const token = downloadAccessToken || (await getZoomAccessToken());
  const url = downloadUrl.includes("?")
    ? `${downloadUrl}&access_token=${encodeURIComponent(token)}`
    : `${downloadUrl}?access_token=${encodeURIComponent(token)}`;

  try {
    const response = await axios.get(url, {
      responseType: "stream",
      // Large cloud recordings can take a long time to stream to GCS
      timeout: Number(
        process.env.ZOOM_RECORDING_DOWNLOAD_TIMEOUT_MS || 2 * 60 * 60 * 1000,
      ),
      headers: {
        Authorization: `Bearer ${token}`,
      },
      maxRedirects: 5,
    });

    const contentType =
      (response.headers["content-type"] as string) || "video/mp4";
    return {
      stream: response.data as NodeJS.ReadableStream,
      contentType,
    };
  } catch (err) {
    throw zoomRecordingErrorFromAxios(err);
  }
}

/**
 * Download a Zoom recording file into a Buffer.
 * Prefer openZoomRecordingDownloadStream for long videos.
 */
export async function downloadZoomRecordingFile(
  downloadUrl: string,
  downloadAccessToken?: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const token = downloadAccessToken || (await getZoomAccessToken());
  const url = downloadUrl.includes("?")
    ? `${downloadUrl}&access_token=${encodeURIComponent(token)}`
    : `${downloadUrl}?access_token=${encodeURIComponent(token)}`;

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    maxContentLength: 2 * 1024 * 1024 * 1024,
    maxBodyLength: 2 * 1024 * 1024 * 1024,
    timeout: 10 * 60 * 1000,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    maxRedirects: 5,
  });

  const contentType =
    (response.headers["content-type"] as string) || "video/mp4";
  return {
    buffer: Buffer.from(response.data),
    contentType,
  };
}
