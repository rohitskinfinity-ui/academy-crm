-- Course final / certificate quiz (unlocked at 90% progress, pass at 75%)

CREATE TABLE IF NOT EXISTS course_final_quizzes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT 'Certificate quiz',
  pass_percent  numeric(5,2) NOT NULL DEFAULT 75.00,
  is_published  boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_final_quizzes_one_per_course UNIQUE (course_id)
);

COMMENT ON TABLE course_final_quizzes IS
  'End-of-course certificate quiz. Students unlock at 90% progress; pass_percent defaults to 75.';

CREATE TABLE IF NOT EXISTS course_final_quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES course_final_quizzes(id) ON DELETE CASCADE,
  prompt          text NOT NULL,
  options         jsonb NOT NULL,
  correct_index   integer NOT NULL,
  explanation     text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_final_quiz_questions_correct_index_check CHECK (correct_index >= 0)
);

CREATE TABLE IF NOT EXISTS course_final_quiz_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  quiz_id         uuid NOT NULL REFERENCES course_final_quizzes(id) ON DELETE CASCADE,
  answers         jsonb NOT NULL DEFAULT '{}'::jsonb,
  score           integer NOT NULL DEFAULT 0,
  max_score       integer NOT NULL DEFAULT 0,
  percent         numeric(5,2) NOT NULL DEFAULT 0,
  passed          boolean NOT NULL DEFAULT false,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS course_final_quiz_attempts_enr_idx
  ON course_final_quiz_attempts (enrollment_id, submitted_at DESC);

ALTER TABLE student_certificates
  ADD COLUMN IF NOT EXISTS recipient_name text;

COMMENT ON COLUMN student_certificates.recipient_name IS
  'Student full name snapshotted when the certificate is issued (printed on PDF).';
