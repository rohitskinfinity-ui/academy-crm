-- Store referral code on confirmed enrollments for CRM payment attribution.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE INDEX IF NOT EXISTS idx_enrollments_referral_code
  ON enrollments (lower(referral_code))
  WHERE referral_code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN enrollments.referral_code IS
  'Active student referral code applied at enrollment (e.g. AMAN7K).';

UPDATE enrollments e
SET referral_code = src.referral_code
FROM (
  SELECT DISTINCT ON (l.enrollment_id)
    l.enrollment_id,
    a.referral_code
  FROM leads l
  JOIN enrollment_applications a ON a.lead_id = l.id
  WHERE l.enrollment_id IS NOT NULL
    AND a.referral_code IS NOT NULL
    AND btrim(a.referral_code) <> ''
  ORDER BY l.enrollment_id, a.created_at DESC
) src
WHERE e.id = src.enrollment_id
  AND e.referral_code IS NULL
  AND e.deleted_at IS NULL;
