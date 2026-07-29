-- Eligible qualifications for course enrollment (e.g. MBBS, BDS for PGDCC)
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS eligible_qualifications text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN courses.eligible_qualifications IS
  'Recognised degrees eligible to enroll, e.g. {MBBS,BDS,BAMS}. Validated on application approval.';
