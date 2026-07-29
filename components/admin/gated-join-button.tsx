"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ExternalLink, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminPost } from "@/lib/api/admin-client";
import {
  getLiveClassJoinWindow,
  joinWindowMessage,
} from "@/lib/liveClassJoinWindow";

type Props = {
  eventId: string;
  startsAt: string;
  endsAt?: string | null;
  durationLabel?: string | null;
  meetingUrl?: string | null;
  status?: string;
  /**
   * Enrolled student UUID — enrollment-gated personal Zoom link + attendance.
   * If omitted, opens admin preview (generic URL, no attendance).
   */
  userId?: string;
  /** Button label override */
  label?: string;
  className?: string;
};

export function GatedJoinButton({
  eventId,
  startsAt,
  endsAt,
  durationLabel,
  meetingUrl,
  status,
  userId,
  label,
  className,
}: Props) {
  const [, setTick] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const joinWindow = getLiveClassJoinWindow({
    starts_at: startsAt,
    ends_at: endsAt,
    duration_label: durationLabel,
    meeting_url: meetingUrl,
    status,
  });

  async function onJoin() {
    setJoining(true);
    try {
      const res = await adminPost<{
        meeting_url: string | null;
        attendance_marked?: boolean;
        preview?: boolean;
      }>(`/api/admin/live-classes/${eventId}/join`, userId
        ? { user_id: userId, mark_attendance: true }
        : { preview: true });

      const url = res.data.meeting_url;
      if (!url) {
        toast.error("Meeting link not available yet");
        return;
      }
      if (res.data.attendance_marked) {
        toast.success("Attendance marked — opening meeting");
      } else if (res.data.preview) {
        toast.message("Admin preview — students need enrollment-gated join");
      }
      globalThis.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(
        axios.isAxiosError(err)
          ? err.response?.data?.message || "Cannot join yet"
          : "Cannot join yet",
      );
    } finally {
      setJoining(false);
    }
  }

  if (!meetingUrl) {
    return (
      <Button size="sm" variant="outline" disabled className={className}>
        No Link
      </Button>
    );
  }

  if (!joinWindow.can_join) {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled
        className={`gap-1.5 ${className ?? ""}`}
        title={joinWindowMessage(joinWindow.reason)}
      >
        <Lock className="size-3.5" />
        {joinWindow.reason === "not_started"
          ? "Join locked"
          : joinWindowMessage(joinWindow.reason)}
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className={`gap-1.5 ${className ?? ""}`}
      disabled={joining}
      onClick={() => void onJoin()}
    >
      {joining ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <ExternalLink className="size-3.5" />
      )}
      {label || (userId ? "Join as student" : "Preview join")}
    </Button>
  );
}
