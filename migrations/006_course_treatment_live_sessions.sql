-- Per-module planned live class count (flexible; not locked to 1/week)
ALTER TABLE course_treatments
  ADD COLUMN IF NOT EXISTS live_sessions_planned integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_treatments_live_sessions_planned_check'
  ) THEN
    ALTER TABLE course_treatments
      ADD CONSTRAINT course_treatments_live_sessions_planned_check
      CHECK (live_sessions_planned >= 0);
  END IF;
END $$;

COMMENT ON COLUMN course_treatments.live_sessions_planned IS
  'How many live classes this module should have for the course. A module may need 1, 2, or more.';
