-- Replace legacy module delivery modes with the new set.
-- Old: hands_on, practical, lecture
-- New: observation, theory, demonstration, training, handson

UPDATE course_treatments
SET delivery_modes = array_replace(delivery_modes, 'lecture', 'theory');

UPDATE course_treatments
SET delivery_modes = array_replace(delivery_modes, 'practical', 'demonstration');

UPDATE course_treatments
SET delivery_modes = array_replace(delivery_modes, 'hands_on', 'handson');

UPDATE course_treatments
SET delivery_modes = ARRAY['theory']::text[]
WHERE delivery_modes IS NULL OR cardinality(delivery_modes) = 0;

COMMENT ON COLUMN course_treatments.delivery_modes IS
  'Selected delivery modes for the module: observation, theory, demonstration, training, handson. Multiple allowed.';
