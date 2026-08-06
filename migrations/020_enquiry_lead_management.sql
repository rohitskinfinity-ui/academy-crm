-- Enquiry lead management: comments, history, payment on enrollment convert.

ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS payment_type TEXT;

DO $$ BEGIN
  ALTER TABLE enrollments
    ADD CONSTRAINT enrollments_payment_type_check
    CHECK (payment_type IS NULL OR payment_type IN ('advance', 'full'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

COMMENT ON COLUMN leads.status IS
  'Lead pipeline: new | contacted | follow_up | converted | lost | closed | spam';

CREATE TABLE IF NOT EXISTS inquiry_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_comments_inquiry
  ON inquiry_comments (inquiry_id, created_at DESC);

CREATE TABLE IF NOT EXISTS inquiry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES contact_inquiries(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inquiry_history_inquiry
  ON inquiry_history (inquiry_id, created_at DESC);
