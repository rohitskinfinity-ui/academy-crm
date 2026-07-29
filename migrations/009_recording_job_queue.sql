-- Durable Zoom→GCP recording job queue (Postgres-backed, no Redis)

ALTER TABLE live_class_recordings
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

CREATE INDEX IF NOT EXISTS live_class_recordings_queue_idx
  ON live_class_recordings (next_attempt_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS live_class_recordings_stale_lock_idx
  ON live_class_recordings (locked_at)
  WHERE status = 'processing';

COMMENT ON COLUMN live_class_recordings.attempt_count IS
  'How many times a worker has claimed this job.';
COMMENT ON COLUMN live_class_recordings.next_attempt_at IS
  'Earliest time a pending job may be claimed (backoff after failures).';
COMMENT ON COLUMN live_class_recordings.locked_at IS
  'Heartbeat while processing; stale locks are re-queued.';
COMMENT ON COLUMN live_class_recordings.locked_by IS
  'Worker id that currently holds the lock.';
