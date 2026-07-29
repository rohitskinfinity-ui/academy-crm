-- Host Zoom start link + meeting credentials for live classes
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS host_start_url text,
  ADD COLUMN IF NOT EXISTS meeting_id text,
  ADD COLUMN IF NOT EXISTS passcode text;

COMMENT ON COLUMN calendar_events.host_start_url IS
  'Zoom host start_url from meeting create. Prefer refreshing via ZAK when starting.';
COMMENT ON COLUMN calendar_events.meeting_id IS
  'Zoom / Meet meeting ID (digits for Zoom).';
COMMENT ON COLUMN calendar_events.passcode IS
  'Meeting passcode (plain or Zoom pwd token from join URL).';
