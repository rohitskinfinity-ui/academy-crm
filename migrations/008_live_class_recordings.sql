-- Live class recordings (non-master): Zoom → GCP, keyed to calendar event + treatment

CREATE TABLE IF NOT EXISTS live_class_recordings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  treatment_id        uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  course_id           uuid REFERENCES courses(id) ON DELETE SET NULL,
  title               text,
  gcp_path            text,
  video_url           text,
  thumbnail_url       text,
  duration_seconds    integer,
  size_bytes          bigint,
  mime_type           text,
  zoom_meeting_id     text,
  zoom_recording_id   text,
  zoom_file_id        text,
  status              recording_status NOT NULL DEFAULT 'pending',
  error_message       text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_class_recordings_zoom_file_unique UNIQUE (zoom_file_id)
);

CREATE INDEX IF NOT EXISTS live_class_recordings_event_idx
  ON live_class_recordings (event_id);

CREATE INDEX IF NOT EXISTS live_class_recordings_treatment_idx
  ON live_class_recordings (treatment_id)
  WHERE status = 'ready';

COMMENT ON TABLE live_class_recordings IS
  'Zoom cloud recordings downloaded to GCP. Belong to a live class occurrence '
  '(calendar_events), not the master treatment_videos library.';

-- Retarget calendar_events away from treatment_videos
DROP TRIGGER IF EXISTS trg_calendar_events_recording_treatment ON calendar_events;
DROP FUNCTION IF EXISTS check_live_class_recording_treatment();

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_recording_link_check;

DROP INDEX IF EXISTS calendar_events_recording_idx;

ALTER TABLE calendar_events
  DROP COLUMN IF EXISTS recording_video_id;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS live_class_recording_id uuid
    REFERENCES live_class_recordings(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_recording_link_check
  CHECK (
    (recording_status = 'ready' AND live_class_recording_id IS NOT NULL)
    OR (recording_status <> 'ready')
  );

CREATE INDEX IF NOT EXISTS calendar_events_live_recording_idx
  ON calendar_events (live_class_recording_id)
  WHERE live_class_recording_id IS NOT NULL;

COMMENT ON COLUMN calendar_events.live_class_recording_id IS
  'Set when recording_status = ready. Points at live_class_recordings (not treatment_videos).';

COMMENT ON COLUMN calendar_events.recording_status IS
  'pending → processing → ready|failed for Zoom→GCP pipeline.';
