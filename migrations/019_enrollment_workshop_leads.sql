-- Link confirmed enrollments to workshops; pending leads stay on enrollment_applications.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS enrollments_workshop_idx
  ON enrollments (workshop_id)
  WHERE deleted_at IS NULL AND workshop_id IS NOT NULL;

COMMENT ON COLUMN enrollments.workshop_id IS
  'Set for workshop enrollments confirmed from leads; course_id stays null.';
