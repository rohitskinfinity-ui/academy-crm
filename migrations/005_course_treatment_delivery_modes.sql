-- Multi-select delivery modes per course module (hands_on, practical, lecture)
ALTER TABLE course_treatments
  ADD COLUMN IF NOT EXISTS delivery_modes text[] NOT NULL DEFAULT '{hands_on}';

COMMENT ON COLUMN course_treatments.delivery_modes IS
  'Selected delivery modes for the module: hands_on, practical, lecture. Multiple allowed.';

-- Backfill from existing hands_on_default
UPDATE course_treatments
SET delivery_modes = CASE
  WHEN hands_on_default THEN ARRAY['hands_on']::text[]
  ELSE ARRAY['lecture']::text[]
END
WHERE delivery_modes = ARRAY['hands_on']::text[]
  AND hands_on_default = false;
