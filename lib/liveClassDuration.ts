/**
 * Zoom basic plan caps group meetings at 40 minutes.
 * Admins can schedule shorter classes; values above the max are clamped.
 */
export const LIVE_CLASS_DURATION_MIN = 15;
export const LIVE_CLASS_DURATION_MAX = 40;
export const LIVE_CLASS_DURATION_MINUTES = LIVE_CLASS_DURATION_MAX;

export function clampLiveClassDuration(minutes?: number | null): number {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) {
    return LIVE_CLASS_DURATION_MINUTES;
  }
  const rounded = Math.round(minutes);
  return Math.min(
    LIVE_CLASS_DURATION_MAX,
    Math.max(LIVE_CLASS_DURATION_MIN, rounded),
  );
}
