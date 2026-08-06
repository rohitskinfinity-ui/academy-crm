-- Dedicated offline workshops (not linked to courses).
-- Separate from calendar_events.type = 'workshop' (course hands-on days).

CREATE TABLE IF NOT EXISTS workshops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  eligibility_html TEXT,
  image_url TEXT,
  starts_on DATE NOT NULL,
  ends_on DATE,
  duration_label TEXT,
  locations TEXT,
  delivery_modes TEXT[] NOT NULL DEFAULT '{}',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  procedures JSONB NOT NULL DEFAULT '[]'::jsonb,
  seats_total INT,
  seats_left INT,
  price NUMERIC(12,2),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  contact_phone TEXT,
  status content_status NOT NULL DEFAULT 'draft',
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_workshops_published
  ON workshops (starts_on)
  WHERE deleted_at IS NULL AND is_published = true AND status = 'published';

COMMENT ON TABLE workshops IS
  'Offline marketing workshops (e.g. injectable masterclass). Not mapped to courses.';

-- Workshop applications share enrollment_applications
ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS workshop_id UUID REFERENCES workshops(id) ON DELETE SET NULL;

ALTER TABLE enrollment_applications
  ADD COLUMN IF NOT EXISTS application_kind TEXT NOT NULL DEFAULT 'course';

-- Backfill + constrain application_kind
UPDATE enrollment_applications
SET application_kind = 'course'
WHERE application_kind IS NULL OR application_kind = '';

DO $$ BEGIN
  ALTER TABLE enrollment_applications
    ADD CONSTRAINT enrollment_applications_kind_check
    CHECK (application_kind IN ('course', 'workshop'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_enrollment_applications_workshop
  ON enrollment_applications (workshop_id)
  WHERE workshop_id IS NOT NULL;
