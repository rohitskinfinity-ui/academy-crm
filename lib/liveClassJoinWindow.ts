/** Students may join only at/after scheduled start (no early join). */
export const JOIN_EARLY_MS = 0;
/** Allow joining a bit after scheduled end (late arrivals / overrun). */
export const JOIN_LATE_GRACE_MS = 30 * 60 * 1000;

export type JoinWindow = {
  can_join: boolean;
  reason: "ok" | "not_started" | "ended" | "cancelled" | "no_url";
  opens_at: string;
  closes_at: string;
  now: string;
};

function durationMinutesFromLabel(label: string | null | undefined): number {
  if (!label) return 60;
  const n = parseInt(label, 10);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

export function getLiveClassJoinWindow(
  event: {
    starts_at: string;
    ends_at?: string | null;
    duration_label?: string | null;
    status?: string;
    meeting_url?: string | null;
  },
  nowMs = Date.now(),
): JoinWindow {
  const startMs = new Date(event.starts_at).getTime();
  const endMs = event.ends_at
    ? new Date(event.ends_at).getTime()
    : startMs + durationMinutesFromLabel(event.duration_label) * 60 * 1000;
  const opensAt = startMs - JOIN_EARLY_MS;
  const closesAt = endMs + JOIN_LATE_GRACE_MS;

  const base = {
    opens_at: new Date(opensAt).toISOString(),
    closes_at: new Date(closesAt).toISOString(),
    now: new Date(nowMs).toISOString(),
  };

  if (event.status === "cancelled") {
    return { can_join: false, reason: "cancelled", ...base };
  }
  if (!event.meeting_url) {
    return { can_join: false, reason: "no_url", ...base };
  }
  if (nowMs < opensAt) {
    return { can_join: false, reason: "not_started", ...base };
  }
  if (nowMs > closesAt) {
    return { can_join: false, reason: "ended", ...base };
  }
  return { can_join: true, reason: "ok", ...base };
}

export function joinWindowMessage(reason: JoinWindow["reason"]): string {
  switch (reason) {
    case "not_started":
      return "Join opens at the scheduled start time";
    case "ended":
      return "Join window ended";
    case "cancelled":
      return "Class cancelled";
    case "no_url":
      return "No meeting link";
    default:
      return "Join available";
  }
}
