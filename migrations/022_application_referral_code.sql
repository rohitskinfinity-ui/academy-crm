-- Store referral code on enrollment applications for attribution + friend discount.

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE INDEX IF NOT EXISTS idx_enrollment_applications_referral_code
  ON enrollment_applications (lower(referral_code))
  WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN enrollment_applications.referral_code IS
  'Active student referral code submitted with the application (e.g. AMAN7K).';
