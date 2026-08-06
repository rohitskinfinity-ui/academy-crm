-- Course gallery media (images/videos for public course detail).
-- Files live in the public GCS bucket; this table stores public URLs.

CREATE TABLE IF NOT EXISTS course_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_course_media_course_sort
  ON course_media (course_id, sort_order)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE course_media IS
  'Course-level gallery images/videos shown on the public marketing course detail page.';
