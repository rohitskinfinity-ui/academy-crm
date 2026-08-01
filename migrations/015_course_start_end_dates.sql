-- Course intake window for public calendar (upcoming / ongoing).
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date;

COMMENT ON COLUMN courses.starts_on IS
  'Public calendar start date for this course intake / programme window.';
COMMENT ON COLUMN courses.ends_on IS
  'Optional end date. Null = ongoing once started until archived.';
