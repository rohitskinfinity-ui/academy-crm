-- Programme metadata for catalog courses (PGDCC: live lectures/week, hands-on days, etc.)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS programme_meta jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN courses.programme_meta IS
  'Structured programme delivery metadata, e.g. live_lectures_per_week, hands_on_days_total, hands_on_months, module_count, min_live_attendance_pct, min_hands_on_days_attended';

-- Link scheduled events to cohort and campus for PGDCC hands-on days
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES batches(id) ON DELETE SET NULL;

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS campus_id uuid REFERENCES campuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS calendar_events_batch_idx
  ON calendar_events (batch_id)
  WHERE batch_id IS NOT NULL AND deleted_at IS NULL;
