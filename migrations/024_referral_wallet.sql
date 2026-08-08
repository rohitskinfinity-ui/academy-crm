-- Referral wallet: credit when a friend enrolls, debit when spent on a later course.

CREATE TABLE IF NOT EXISTS referral_wallet_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount          numeric(12,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'INR',
  kind            text NOT NULL CHECK (kind IN ('referral_reward', 'enrollment_redeem')),
  referral_id     uuid REFERENCES referrals(id) ON DELETE SET NULL,
  enrollment_id   uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_wallet_ledger_amount_nonzero CHECK (amount <> 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_wallet_reward_once
  ON referral_wallet_ledger (referral_id)
  WHERE kind = 'referral_reward' AND referral_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_wallet_redeem_once
  ON referral_wallet_ledger (enrollment_id)
  WHERE kind = 'enrollment_redeem' AND enrollment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_referral_wallet_user
  ON referral_wallet_ledger (user_id, created_at DESC);

COMMENT ON TABLE referral_wallet_ledger IS
  'Referrer cashback credits (+) and redemptions on later enrollments (-).';

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS use_referral_credit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN enrollment_applications.use_referral_credit IS
  'Student asked to apply their referral wallet on this application.';

INSERT INTO referral_wallet_ledger (user_id, amount, currency, kind, referral_id)
SELECT
  r.referrer_id,
  COALESCE(r.reward_amount, rc.reward_amount, 2000),
  COALESCE(NULLIF(btrim(r.currency), ''), NULLIF(btrim(rc.currency), ''), 'INR'),
  'referral_reward',
  r.id
FROM referrals r
LEFT JOIN referral_codes rc ON rc.id = r.referral_code_id
WHERE r.status IN ('enrolled', 'rewarded')
  AND COALESCE(r.reward_amount, rc.reward_amount, 2000) > 0
  AND NOT EXISTS (
    SELECT 1
    FROM referral_wallet_ledger w
    WHERE w.referral_id = r.id AND w.kind = 'referral_reward'
  );
