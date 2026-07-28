import axios from "axios";

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
};

type ZoomMeetingResult = {
  id: string | number;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
};

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

/**
  Creates a Zoom scheduled meeting via Server-to-Server OAuth API
 */
export async function createZoomMeeting(
  opts: ZoomCreateMeetingOptions,
): Promise<ZoomMeetingResult> {
  const token = await getZoomAccessToken();
  const startTime = new Date(opts.starts_at).toISOString();

  try {
    const response = await axios.post<ZoomMeetingResult>(
      "https://api.zoom.us/v2/users/me/meetings",
      {
        topic: opts.topic,
        type: 2, // Scheduled Meeting
        start_time: startTime,
        duration: opts.duration_minutes || 60,
        agenda:
          opts.agenda || "Skinfinity Academy Weekly Doctor Connect Live Class",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false, // Restrict early entry before host/start time
          waiting_room: true,      // Enable Zoom Waiting Room / Lobby
          mute_upon_entry: true,   // Mute participant microphones on entry
          watermark: true,
          auto_recording: "cloud",
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
