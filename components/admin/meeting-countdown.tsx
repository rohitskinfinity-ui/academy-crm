"use client";

import { useEffect, useState } from "react";
import { Clock, Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type MeetingCountdownProps = {
  startsAt: string;
  durationMinutes?: number;
  className?: string;
};

export function MeetingCountdown({
  startsAt,
  durationMinutes = 60,
  className = "",
}: MeetingCountdownProps) {
  const [statusText, setStatusText] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [isEnded, setIsEnded] = useState(false);

  useEffect(() => {
    function updateCountdown() {
      const now = Date.now();
      const start = new Date(startsAt).getTime();
      const end = start + durationMinutes * 60 * 1000;

      if (now < start) {
        // Future meeting: Countdown to start
        const diffMs = start - now;
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / (3600 * 24));
        const hours = Math.floor((totalSec % (3600 * 24)) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;

        setIsLive(false);
        setIsEnded(false);

        if (days > 0) {
          setStatusText(`Starts in: ${days}d ${hours}h ${minutes}m`);
        } else if (hours > 0) {
          setStatusText(`Starts in: ${hours}h ${minutes}m ${seconds}s`);
        } else {
          setStatusText(`Starts in: ${minutes}m ${seconds}s`);
        }
      } else if (now >= start && now <= end) {
        // Live meeting: Countdown to end
        const diffMs = end - now;
        const totalSec = Math.floor(diffMs / 1000);
        const minutes = Math.floor(totalSec / 60);
        const seconds = totalSec % 60;

        setIsLive(true);
        setIsEnded(false);
        setStatusText(`Live Now — ${minutes}m ${seconds}s left`);
      } else {
        // Meeting ended
        setIsLive(false);
        setIsEnded(true);
        setStatusText("Session Ended");
      }
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [startsAt, durationMinutes]);

  if (isEnded) {
    return (
      <Badge variant="outline" className={`text-muted-foreground ${className}`}>
        {statusText}
      </Badge>
    );
  }

  if (isLive) {
    return (
      <Badge
        className={`bg-red-600 text-white font-bold animate-pulse flex items-center gap-1.5 ${className}`}
      >
        <Radio className="size-3" />
        {statusText}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 flex items-center gap-1.5 font-medium ${className}`}
    >
      <Clock className="size-3 text-amber-500" />
      {statusText}
    </Badge>
  );
}
