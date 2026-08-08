-- =============================================================================
-- Skinfinity Academy — PostgreSQL Schema
-- Covers: marketing CMS + student LMS (treatment-based pedagogy)
--
-- Pedagogy (canonical):
--   1. Upload a master library of treatments (procedures).
--   2. Build a course by selecting treatments from that library.
--   3. Each treatment has four stages: theory → observation → training → hands-on.
--   4. Theory = videos + booklets + quiz (pass quiz to complete theory).
--   5. Enrollments can be customized per student (add/remove treatments,
--      toggle hands-on, adjust price — not a fixed package).
--   6. Live doctor classes (Zoom primary; Meet supported) + Drive booklet PPT.
--      live_class requires treatment_id (folder) + meeting_url.
--      Recordings publish to treatment_videos when ready; optional quiz + attachments.
--      Recurrence via recurrence_rule (RRULE) + series_id for weekly / alternate-day.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin', 'staff');
CREATE TYPE membership_tier AS ENUM ('standard', 'pro');
CREATE TYPE gender_type AS ENUM ('female', 'male', 'other', 'prefer_not_to_say');

CREATE TYPE content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE course_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE course_mode AS ENUM ('online', 'offline', 'hybrid');

CREATE TYPE treatment_stage AS ENUM ('theory', 'observation', 'training', 'hands-on');
CREATE TYPE stage_status AS ENUM ('locked', 'available', 'in_progress', 'completed');
CREATE TYPE video_kind AS ENUM ('lecture', 'ai_procedure', 'clinical');

CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'cancelled', 'suspended');
CREATE TYPE enrollment_origin AS ENUM ('catalog', 'custom'); -- template course vs fully custom pathway

CREATE TYPE assignment_status AS ENUM ('pending', 'submitted', 'graded', 'overdue');
CREATE TYPE assignment_stage AS ENUM ('observation', 'training', 'hands-on'); -- practical only

CREATE TYPE event_type AS ENUM (
  'workshop',
  'live_class',      -- weekly doctor Meet class
  'course_batch',
  'exam',
  'other'
);
CREATE TYPE event_status AS ENUM ('scheduled', 'live', 'completed', 'cancelled');

CREATE TYPE video_platform AS ENUM ('zoom', 'google_meet');
CREATE TYPE recording_status AS ENUM ('pending', 'processing', 'ready', 'failed');

CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded', 'partial');
CREATE TYPE payment_method AS ENUM ('credit_card', 'upi', 'bank_transfer', 'cash', 'other');
CREATE TYPE payment_option AS ENUM ('deposit', 'full', 'callback');

CREATE TYPE referral_status AS ENUM ('pending', 'enrolled', 'rewarded', 'expired');
CREATE TYPE lead_channel AS ENUM ('contact', 'enroll', 'enrollment_modal', 'newsletter', 'callback', 'other');
CREATE TYPE application_status AS ENUM (
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'enrolled',
  'withdrawn'
);

CREATE TYPE testimonial_type AS ENUM ('text', 'video');
CREATE TYPE notification_type AS ENUM (
  'assignment',
  'live_class',
  'certificate',
  'grade',
  'message',
  'course_update',
  'payment',
  'referral',
  'system'
);

CREATE TYPE medical_background AS ENUM ('yes', 'no');
CREATE TYPE currently_working AS ENUM ('yes', 'no');

-- =============================================================================
-- DOMAIN 1 — Identity & auth
-- =============================================================================

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext,
  email_verified_at timestamptz,
  password_hash   text,              -- bcrypt; used by admin JWT auth
  full_name       text NOT NULL,
  display_name    text,
  avatar_url      text,
  role            user_role NOT NULL DEFAULT 'student',
  is_active       boolean NOT NULL DEFAULT true,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  CONSTRAINT users_email_unique UNIQUE (email)
);

COMMENT ON TABLE users IS 'Core identity (email/password admin JWT + Google OAuth). Maps to /login and LMS chrome.';

CREATE TABLE oauth_accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          text NOT NULL, -- e.g. 'google'
  provider_user_id  text NOT NULL,
  access_token      text,
  refresh_token     text,
  expires_at        timestamptz,
  raw_profile       jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oauth_provider_user_unique UNIQUE (provider, provider_user_id)
);

CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  user_agent    text,
  ip_address    inet,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_profiles (
  user_id                 uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone                   text,
  whatsapp                text,
  alternate_phone         text,
  location                text,          -- e.g. 'Hyderabad, India'
  address_line            text,
  city_state              text,
  pin_code                text,
  date_of_birth           date,
  gender                  gender_type,
  membership_tier         membership_tier NOT NULL DEFAULT 'standard',
  program_label           text,          -- e.g. 'Fellowship in Aesthetic Dermatology'
  highest_qualification   text,
  profession              text,
  medical_background      medical_background,
  registration_no         text,          -- medical council / dental reg
  currently_working       currently_working,
  guardian_name           text,
  weekly_goal_hours       numeric(5,2) NOT NULL DEFAULT 15,
  avatar_initials         text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE student_profiles IS 'LMS profile fields from /dashboard/profile and /enroll.';

CREATE TABLE instructor_profiles (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialization    text,
  experience_years  integer,
  hospital          text,
  credentials       text,
  bio               text,
  is_public_faculty boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOMAIN 2 — Treatment library (atomic content units)
-- Admin uploads ALL treatments first; courses pick from this library.
-- =============================================================================

CREATE TABLE treatments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE,   -- e.g. 'botox', 'fillers', 'threads'
  name            text NOT NULL,          -- e.g. 'Botulinum Toxin'
  summary         text,
  image_url       text,
  status          content_status NOT NULL DEFAULT 'draft',
  sort_order      integer NOT NULL DEFAULT 0,
  -- Optional suggested list price for this treatment (custom packages sum these)
  base_price      numeric(12,2),
  currency        char(3) NOT NULL DEFAULT 'INR',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

COMMENT ON TABLE treatments IS
  'Master procedure library. Courses and custom enrollments select from here.';

-- Stage metadata (title/description/checklist) per treatment × stage
CREATE TABLE treatment_stages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id    uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  stage           treatment_stage NOT NULL,
  title           text NOT NULL,
  description     text,
  checklist       jsonb NOT NULL DEFAULT '[]'::jsonb, -- string[] checklist items
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treatment_stages_unique UNIQUE (treatment_id, stage)
);

COMMENT ON TABLE treatment_stages IS
  'Four categories per treatment: theory, observation, training, hands-on.';

-- Theory videos (lecture / AI procedure / clinical)
CREATE TABLE treatment_videos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id      uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  stage             treatment_stage NOT NULL DEFAULT 'theory',
  title             text NOT NULL,
  kind              video_kind NOT NULL DEFAULT 'lecture',
  duration_seconds  integer,
  video_url         text,
  thumbnail_url     text,
  instructor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  is_published      boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX treatment_videos_treatment_idx
  ON treatment_videos (treatment_id, stage, sort_order)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE treatment_videos IS
  'On-demand master library videos per treatment stage (lecture / AI / clinical). '
  'Live class Zoom recordings are stored in live_class_recordings, not here.';

-- Theory booklets / PDFs (and Drive-linked PPT for live classes)
CREATE TABLE treatment_booklets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id    uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  stage           treatment_stage NOT NULL DEFAULT 'theory',
  name            text NOT NULL,
  file_url        text,                  -- hosted PDF
  drive_url       text,                  -- Google Drive link (booklet PPT)
  size_bytes      bigint,
  mime_type       text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Theory quiz (pass to complete theory stage)
CREATE TABLE treatment_quizzes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id        uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  title               text NOT NULL DEFAULT 'Theory quiz',
  pass_percent        numeric(5,2) NOT NULL DEFAULT 66.00,
  is_required         boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT treatment_quizzes_one_per_treatment UNIQUE (treatment_id)
);

CREATE TABLE quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES treatment_quizzes(id) ON DELETE CASCADE,
  prompt          text NOT NULL,
  options         jsonb NOT NULL,        -- string[] length >= 2
  correct_index   integer NOT NULL,
  explanation     text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_questions_correct_index_check CHECK (correct_index >= 0)
);

COMMENT ON TABLE treatment_quizzes IS
  'End-of-theory quiz. Passing unlocks observation (see enrollment_treatment_stages).';

-- =============================================================================
-- DOMAIN 3 — Course catalog (marketing + template pathways)
-- A course is a named selection of treatments (template). Students may enroll
-- in the template as-is OR get a customized treatment set with custom price.
-- =============================================================================

CREATE TABLE course_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  title       text NOT NULL,             -- Fellowship / Certificate / Workshop / cosmetology…
  icon        text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE campuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  city        text,
  address     text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE batches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid, -- set FK after courses created (deferred below)
  campus_id       uuid REFERENCES campuses(id) ON DELETE SET NULL,
  name            text NOT NULL,
  starts_on       date,
  ends_on         date,
  training_mode   course_mode,
  seats_total     integer,
  seats_left      integer,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  title               text NOT NULL,
  description         text,
  image_url           text,
  duration_label      text,              -- e.g. '6 Months'
  mode                course_mode,
  level               course_level,
  category_id         uuid REFERENCES course_categories(id) ON DELETE SET NULL,
  -- Marketing list/base price (custom enrollments override)
  list_price          numeric(12,2),
  currency            char(3) NOT NULL DEFAULT 'INR',
  rating              numeric(2,1),
  certificate_label   text,
  faculty_lead_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  tag                 text,
  is_bestseller       boolean NOT NULL DEFAULT false,
  is_customizable     boolean NOT NULL DEFAULT true, -- Rohit: packages are not fixed
  status              content_status NOT NULL DEFAULT 'draft',
  seo_title           text,
  seo_description     text,
  color_token         text,              -- LMS card gradient hint
  programme_meta      jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligible_qualifications text[] NOT NULL DEFAULT '{}',
  published_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

COMMENT ON TABLE courses IS
  'Catalog / template courses. Treatments attached via course_treatments. '
  'Custom student pathways may diverge at enrollment time.';

ALTER TABLE batches
  ADD CONSTRAINT batches_course_fk
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;

-- Default treatments included when someone buys this catalog course
CREATE TABLE course_treatments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id           uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  treatment_id        uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  sort_order          integer NOT NULL DEFAULT 0,
  hands_on_default    boolean NOT NULL DEFAULT true, -- default for new enrollments
  delivery_modes      text[] NOT NULL DEFAULT '{hands_on}', -- hands_on | practical | lecture
  live_sessions_planned integer NOT NULL DEFAULT 1
                        CHECK (live_sessions_planned >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_treatments_unique UNIQUE (course_id, treatment_id)
);

CREATE TABLE course_faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question    text NOT NULL,
  answer      text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Navbar megamenu: category → course links (optional badge)
CREATE TABLE course_nav_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES course_categories(id) ON DELETE CASCADE,
  course_id     uuid REFERENCES courses(id) ON DELETE CASCADE,
  label         text NOT NULL,
  slug          text NOT NULL,
  badge         text,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE course_final_quizzes (
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

CREATE TABLE course_final_quiz_questions (
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

-- =============================================================================
-- DOMAIN 4 — Enrollments & customized pathways
-- =============================================================================

CREATE TABLE enrollments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Nullable when fully custom pathway with no catalog template
  course_id           uuid REFERENCES courses(id) ON DELETE SET NULL,
  title               text NOT NULL,     -- snapshot / custom name shown in LMS
  origin              enrollment_origin NOT NULL DEFAULT 'catalog',
  status              enrollment_status NOT NULL DEFAULT 'active',
  -- Custom price (Rohit: budget is never fixed; adjust when treatments change)
  agreed_price        numeric(12,2),
  currency            char(3) NOT NULL DEFAULT 'INR',
  referral_code       text,              -- student referral code (e.g. AMAN7K)
  color_token         text,
  progress_pct        numeric(5,2) NOT NULL DEFAULT 0
                        CHECK (progress_pct >= 0 AND progress_pct <= 100),
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  batch_id            uuid REFERENCES batches(id) ON DELETE SET NULL,
  campus_id           uuid REFERENCES campuses(id) ON DELETE SET NULL,
  notes_internal      text,              -- staff notes on customization
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX enrollments_user_idx ON enrollments (user_id) WHERE deleted_at IS NULL;
CREATE INDEX enrollments_course_idx ON enrollments (course_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_enrollments_referral_code
  ON enrollments (lower(referral_code))
  WHERE referral_code IS NOT NULL AND deleted_at IS NULL;

COMMENT ON TABLE enrollments IS
  'Student pathway. May mirror a catalog course or be fully customized '
  '(e.g. BDS advanced without fillers/botox/threads; MBBS without threads).';

-- Which treatments this student actually gets (add/remove from template)
CREATE TABLE enrollment_treatments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id       uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  treatment_id        uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  sort_order          integer NOT NULL DEFAULT 0,
  -- Per-treatment hands-on toggle (Rohit: "whether I want to give hands-on or not")
  hands_on_included   boolean NOT NULL DEFAULT true,
  current_stage       treatment_stage NOT NULL DEFAULT 'theory',
  unlocked_at         timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_treatments_unique UNIQUE (enrollment_id, treatment_id)
);

COMMENT ON COLUMN enrollment_treatments.hands_on_included IS
  'If false, stage path is theory → observation → training only.';

-- Stage progress per enrolled treatment
CREATE TABLE enrollment_treatment_stages (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_treatment_id uuid NOT NULL REFERENCES enrollment_treatments(id) ON DELETE CASCADE,
  stage                   treatment_stage NOT NULL,
  status                  stage_status NOT NULL DEFAULT 'locked',
  started_at              timestamptz,
  completed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT enrollment_treatment_stages_unique UNIQUE (enrollment_treatment_id, stage)
);

-- Video watch progress (theory / any stage videos)
CREATE TABLE video_progress (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_treatment_id uuid NOT NULL REFERENCES enrollment_treatments(id) ON DELETE CASCADE,
  video_id                uuid NOT NULL REFERENCES treatment_videos(id) ON DELETE CASCADE,
  last_position_seconds   integer NOT NULL DEFAULT 0,
  watched_percent         numeric(5,2) NOT NULL DEFAULT 0,
  is_completed            boolean NOT NULL DEFAULT false,
  completed_at            timestamptz,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT video_progress_unique UNIQUE (enrollment_treatment_id, video_id)
);

-- Booklet read acknowledgement (optional gate)
CREATE TABLE booklet_progress (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_treatment_id uuid NOT NULL REFERENCES enrollment_treatments(id) ON DELETE CASCADE,
  booklet_id              uuid NOT NULL REFERENCES treatment_booklets(id) ON DELETE CASCADE,
  opened_at               timestamptz NOT NULL DEFAULT now(),
  is_completed            boolean NOT NULL DEFAULT false,
  completed_at            timestamptz,
  CONSTRAINT booklet_progress_unique UNIQUE (enrollment_treatment_id, booklet_id)
);

-- Quiz attempts (theory completion)
CREATE TABLE quiz_attempts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_treatment_id uuid NOT NULL REFERENCES enrollment_treatments(id) ON DELETE CASCADE,
  quiz_id                 uuid NOT NULL REFERENCES treatment_quizzes(id) ON DELETE CASCADE,
  answers                 jsonb NOT NULL DEFAULT '{}'::jsonb, -- { questionId: selectedIndex }
  score                   integer NOT NULL DEFAULT 0,
  max_score               integer NOT NULL DEFAULT 0,
  percent                 numeric(5,2) NOT NULL DEFAULT 0,
  passed                  boolean NOT NULL DEFAULT false,
  submitted_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX quiz_attempts_et_idx ON quiz_attempts (enrollment_treatment_id, submitted_at DESC);

-- Bookmarks (video timestamp within a treatment)
CREATE TABLE bookmarks (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id           uuid REFERENCES enrollments(id) ON DELETE CASCADE,
  treatment_id            uuid NOT NULL REFERENCES treatments(id) ON DELETE CASCADE,
  video_id                uuid REFERENCES treatment_videos(id) ON DELETE SET NULL,
  title                   text NOT NULL, -- lesson/video title snapshot
  module_label            text,          -- e.g. 'Theory' / stage label
  timestamp_seconds       integer,
  created_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

CREATE INDEX bookmarks_user_idx ON bookmarks (user_id) WHERE deleted_at IS NULL;

-- Notes (treatment / video scoped)
CREATE TABLE notes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id           uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  treatment_id            uuid REFERENCES treatments(id) ON DELETE SET NULL,
  video_id                uuid REFERENCES treatment_videos(id) ON DELETE SET NULL,
  title                   text,
  body                    text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  deleted_at              timestamptz
);

-- Discussion on a treatment / enrollment
CREATE TABLE discussion_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id   uuid REFERENCES enrollments(id) ON DELETE CASCADE,
  course_id       uuid REFERENCES courses(id) ON DELETE CASCADE,
  treatment_id    uuid REFERENCES treatments(id) ON DELETE SET NULL,
  author_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id       uuid REFERENCES discussion_posts(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE TABLE learning_stats_daily (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stat_date       date NOT NULL,
  hours           numeric(6,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_stats_daily_unique UNIQUE (user_id, stat_date)
);

CREATE TABLE achievements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  label       text NOT NULL,
  description text,
  icon        text,
  color_token text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id  uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_achievements_unique UNIQUE (user_id, achievement_id)
);

-- =============================================================================
-- DOMAIN 5 — Assignments (observation / training / hands-on practicals)
-- =============================================================================

CREATE TABLE assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       uuid REFERENCES courses(id) ON DELETE SET NULL,
  treatment_id    uuid REFERENCES treatments(id) ON DELETE SET NULL,
  stage           assignment_stage NOT NULL DEFAULT 'training',
  title           text NOT NULL,
  brief           text,
  requirements    jsonb NOT NULL DEFAULT '[]'::jsonb, -- e.g. ["PDF","Images","1500 words"]
  max_marks       integer NOT NULL DEFAULT 100,
  due_at          timestamptz,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Assign a practical to a specific enrollment (custom pathways)
CREATE TABLE assignment_targets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  due_at          timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_targets_unique UNIQUE (assignment_id, enrollment_id)
);

CREATE TABLE assignment_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  enrollment_id   uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status          assignment_status NOT NULL DEFAULT 'pending',
  marks           numeric(6,2),
  submitted_at    timestamptz,
  graded_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assignment_submissions_unique UNIQUE (assignment_id, enrollment_id)
);

CREATE TABLE assignment_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  file_url        text NOT NULL,
  size_bytes      bigint,
  mime_type       text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assignment_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  instructor_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOMAIN 6 — Calendar, workshops, weekly live doctor classes
-- =============================================================================

CREATE TABLE calendar_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              event_type NOT NULL,
  slug              text UNIQUE,
  title             text NOT NULL,
  description       text,
  category_label    text,                -- e.g. 'Hands-on Workshop', 'Laser Masterclass'
  starts_at         timestamptz NOT NULL,
  ends_at           timestamptz,
  duration_label    text,                -- e.g. '1 hour', '2 hours'
  location          text,                -- city
  venue             text,
  seats_total       integer,
  seats_left        integer,
  price             numeric(12,2),
  currency          char(3) NOT NULL DEFAULT 'INR',
  image_url         text,
  instructor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  course_id         uuid REFERENCES courses(id) ON DELETE SET NULL,
  treatment_id      uuid REFERENCES treatments(id) ON DELETE SET NULL,
  batch_id          uuid REFERENCES batches(id) ON DELETE SET NULL,
  campus_id         uuid REFERENCES campuses(id) ON DELETE SET NULL,
  -- Live class: Zoom (default) or Google Meet + optional Drive booklet PPT
  platform              video_platform NOT NULL DEFAULT 'zoom',
  meeting_url           text,
  host_start_url        text,            -- Zoom host start link (prefer ZAK refresh)
  meeting_id            text,
  passcode              text,
  drive_url             text,
  booklet_label         text,
  recording_status      recording_status NOT NULL DEFAULT 'pending',
  live_class_recording_id uuid,          -- FK added after live_class_recordings exists
  -- Recurrence (daily / alternate-day / weekly). Null = one-off class.
  -- Example RRULE: FREQ=WEEKLY;BYDAY=MO  or  FREQ=DAILY;INTERVAL=2
  recurrence_rule       text,
  recurrence_until      timestamptz,
  series_id             uuid,            -- shared across expanded occurrences
  status            event_status NOT NULL DEFAULT 'scheduled',
  is_published      boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  -- Live classes must name the treatment folder for recordings + student pathway
  CONSTRAINT calendar_events_live_class_treatment_check
    CHECK (type <> 'live_class' OR treatment_id IS NOT NULL),
  -- Live classes need a join URL
  CONSTRAINT calendar_events_live_class_meeting_check
    CHECK (type <> 'live_class' OR meeting_url IS NOT NULL),
  -- recording ready ⇒ pointer to live_class_recordings row
  CONSTRAINT calendar_events_recording_link_check
    CHECK (
      (recording_status = 'ready' AND live_class_recording_id IS NOT NULL)
      OR (recording_status <> 'ready')
    )
);

CREATE INDEX calendar_events_starts_idx
  ON calendar_events (starts_at)
  WHERE deleted_at IS NULL AND is_published = true;

CREATE INDEX calendar_events_type_idx ON calendar_events (type, status);

CREATE INDEX calendar_events_series_idx
  ON calendar_events (series_id)
  WHERE series_id IS NOT NULL;

CREATE INDEX calendar_events_treatment_idx
  ON calendar_events (treatment_id)
  WHERE type = 'live_class' AND deleted_at IS NULL;

COMMENT ON TABLE calendar_events IS
  'Workshops, course calendar, exams, and live doctor classes '
  '(Zoom/Meet + Drive PPT). Recordings live in live_class_recordings. '
  'Maps to /workshops, /course-calendar, /dashboard/live.';

COMMENT ON COLUMN calendar_events.live_class_recording_id IS
  'Set when recording_status = ready. Points at live_class_recordings '
  '(same treatment_id as this event). Not treatment_videos.';

COMMENT ON COLUMN calendar_events.platform IS
  'Video platform for live_class events. Zoom is the default; google_meet supported.';

COMMENT ON COLUMN calendar_events.treatment_id IS
  'Required for live_class. Links the occurrence to a master treatment; '
  'recordings are stored separately in live_class_recordings.';

COMMENT ON COLUMN calendar_events.recurrence_rule IS
  'iCal RRULE for series schedules (weekly, daily, alternate-day). Null = single session. '
  'App expands occurrences into rows sharing series_id.';

COMMENT ON COLUMN calendar_events.series_id IS
  'Groups expanded live-class occurrences from the same recurring schedule.';

CREATE TABLE live_class_recordings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  treatment_id        uuid NOT NULL REFERENCES treatments(id) ON DELETE RESTRICT,
  course_id           uuid REFERENCES courses(id) ON DELETE SET NULL,
  title               text,
  gcp_path            text,
  video_url           text,
  thumbnail_url       text,
  duration_seconds    integer,
  size_bytes          bigint,
  mime_type           text,
  zoom_meeting_id     text,
  zoom_recording_id   text,
  zoom_file_id        text,
  status              recording_status NOT NULL DEFAULT 'pending',
  error_message       text,
  -- Durable job queue (worker claims pending rows; heartbeats via locked_at)
  attempt_count       integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 5,
  next_attempt_at     timestamptz NOT NULL DEFAULT now(),
  locked_at           timestamptz,
  locked_by           text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_class_recordings_zoom_file_unique UNIQUE (zoom_file_id)
);

CREATE INDEX live_class_recordings_event_idx
  ON live_class_recordings (event_id);

CREATE INDEX live_class_recordings_treatment_idx
  ON live_class_recordings (treatment_id)
  WHERE status = 'ready';

CREATE INDEX live_class_recordings_queue_idx
  ON live_class_recordings (next_attempt_at ASC)
  WHERE status = 'pending';

CREATE INDEX live_class_recordings_stale_lock_idx
  ON live_class_recordings (locked_at)
  WHERE status = 'processing';

COMMENT ON TABLE live_class_recordings IS
  'Zoom cloud recordings downloaded to GCP via a Postgres-backed job queue. '
  'Belong to a live class occurrence (calendar_events), not treatment_videos.';

ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_live_recording_fk
  FOREIGN KEY (live_class_recording_id)
  REFERENCES live_class_recordings(id) ON DELETE SET NULL;

CREATE INDEX calendar_events_live_recording_idx
  ON calendar_events (live_class_recording_id)
  WHERE live_class_recording_id IS NOT NULL;

CREATE OR REPLACE FUNCTION check_live_class_recording_treatment()
RETURNS trigger AS $$
DECLARE
  rec_treatment uuid;
BEGIN
  IF NEW.live_class_recording_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT treatment_id INTO rec_treatment
  FROM live_class_recordings
  WHERE id = NEW.live_class_recording_id;

  IF rec_treatment IS NULL THEN
    RAISE EXCEPTION 'live_class_recording_id % not found', NEW.live_class_recording_id;
  END IF;

  IF NEW.treatment_id IS DISTINCT FROM rec_treatment THEN
    RAISE EXCEPTION
      'live recording treatment (%) must match calendar_events.treatment_id (%)',
      rec_treatment, NEW.treatment_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calendar_events_recording_treatment
  BEFORE INSERT OR UPDATE OF live_class_recording_id, treatment_id
  ON calendar_events
  FOR EACH ROW
  EXECUTE PROCEDURE check_live_class_recording_treatment();

CREATE TABLE event_registrations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id   uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'registered',
  registered_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_registrations_unique UNIQUE (event_id, user_id)
);

CREATE TABLE event_reminders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reminded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_reminders_unique UNIQUE (event_id, user_id)
);

CREATE TABLE event_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checked_in_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_attendance_unique UNIQUE (event_id, user_id)
);

-- Optional assessment attached to a specific live class (not the treatment theory quiz)
CREATE TABLE event_quizzes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  title         text NOT NULL DEFAULT 'Live class assessment',
  pass_percent  numeric(5,2) NOT NULL DEFAULT 66.00,
  is_required   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_quizzes_one_per_event UNIQUE (event_id)
);

COMMENT ON TABLE event_quizzes IS
  'Optional quiz uploaded alongside a live class recording. is_required defaults false '
  'since the assessment is optional per class.';

CREATE TABLE event_quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES event_quizzes(id) ON DELETE CASCADE,
  prompt          text NOT NULL,
  options         jsonb NOT NULL,
  correct_index   integer NOT NULL CHECK (correct_index >= 0),
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE TABLE event_quiz_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES event_quizzes(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers       jsonb NOT NULL DEFAULT '{}'::jsonb,
  percent       numeric(5,2) NOT NULL DEFAULT 0,
  passed        boolean NOT NULL DEFAULT false,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_quiz_attempts_user_idx ON event_quiz_attempts (quiz_id, user_id);

-- Optional file(s) uploaded alongside the recording (staff notes, case slides, extra PDF)
CREATE TABLE event_attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  mime_type   text,
  size_bytes  bigint,
  uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_attachments_event_idx ON event_attachments (event_id);

-- =============================================================================
-- DOMAIN 7 — Certificates & institutional accreditations
-- =============================================================================

CREATE TABLE course_final_quiz_attempts (
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

CREATE INDEX course_final_quiz_attempts_enr_idx
  ON course_final_quiz_attempts (enrollment_id, submitted_at DESC);

CREATE TABLE student_certificates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id       uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  course_id           uuid REFERENCES courses(id) ON DELETE SET NULL,
  title               text NOT NULL,
  recipient_name      text,              -- snapshotted student name printed on PDF
  instructor_name     text,
  grade               text,              -- e.g. 'A+', 'A'
  certificate_code    text NOT NULL UNIQUE, -- e.g. 'SKN-2025-001'
  verify_token        text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  pdf_url             text,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  revoked_at          timestamptz
);

COMMENT ON TABLE student_certificates IS 'Student completion certificates — /dashboard/certificates.';

CREATE TABLE institutional_certificates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,      -- 'iso-9001', 'ieb'
  badge       text,
  title       text NOT NULL,
  subtitle    text,
  description text,
  pdf_path    text,                      -- filesystem / storage path
  view_url    text,                      -- /api/certificates/{code}
  logo_url    text,
  color_token text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE affiliations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  logo_url    text,
  color_token text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOMAIN 8 — Payments & referrals
-- =============================================================================

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_code        text NOT NULL UNIQUE,  -- e.g. 'TXN-001'
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enrollment_id   uuid REFERENCES enrollments(id) ON DELETE SET NULL,
  course_id       uuid REFERENCES courses(id) ON DELETE SET NULL,
  event_id        uuid REFERENCES calendar_events(id) ON DELETE SET NULL,
  amount          numeric(12,2) NOT NULL,
  currency        char(3) NOT NULL DEFAULT 'INR',
  method          payment_method,
  status          payment_status NOT NULL DEFAULT 'pending',
  payment_option  payment_option,        -- deposit / full / callback
  description     text,                  -- course/workshop title snapshot
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);

CREATE TABLE payment_receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id  uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  file_url    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referral_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code        text NOT NULL UNIQUE,      -- e.g. 'ARJUN2K'
  reward_amount numeric(12,2) NOT NULL DEFAULT 2000,
  currency    char(3) NOT NULL DEFAULT 'INR',
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referrals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id  uuid NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referrer_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_name      text,
  invitee_email     text,
  invitee_user_id   uuid REFERENCES users(id) ON DELETE SET NULL,
  status            referral_status NOT NULL DEFAULT 'pending',
  reward_amount     numeric(12,2),
  currency          char(3) NOT NULL DEFAULT 'INR',
  avatar_url        text,
  enrolled_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE referral_wallet_ledger (
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

CREATE UNIQUE INDEX idx_referral_wallet_reward_once
  ON referral_wallet_ledger (referral_id)
  WHERE kind = 'referral_reward' AND referral_id IS NOT NULL;

CREATE UNIQUE INDEX idx_referral_wallet_redeem_once
  ON referral_wallet_ledger (enrollment_id)
  WHERE kind = 'enrollment_redeem' AND enrollment_id IS NOT NULL;

CREATE INDEX idx_referral_wallet_user
  ON referral_wallet_ledger (user_id, created_at DESC);

-- =============================================================================
-- DOMAIN 9 — Marketing CMS
-- =============================================================================

CREATE TABLE blog_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,             -- Research / Case Study / Medical Updates
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE blog_posts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  category_id         uuid REFERENCES blog_categories(id) ON DELETE SET NULL,
  title               text NOT NULL,
  excerpt             text,
  body                text,              -- markdown/html (detail page ready)
  image_url           text,
  author_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name         text,              -- denormalized display
  read_time_minutes   integer,
  status              content_status NOT NULL DEFAULT 'draft',
  published_at        timestamptz,
  seo_title           text,
  seo_description     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX blog_posts_published_idx
  ON blog_posts (published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

CREATE TABLE blog_tags (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug  text NOT NULL UNIQUE,
  name  text NOT NULL
);

CREATE TABLE blog_post_tags (
  post_id uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE testimonials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            testimonial_type NOT NULL DEFAULT 'text',
  person_name     text NOT NULL,         -- doctor / alumni name
  credentials     text,
  role            text,
  company         text,                  -- clinic / company
  location        text,
  course_id       uuid REFERENCES courses(id) ON DELETE SET NULL,
  course_label    text,                  -- snapshot if course deleted
  rating          numeric(2,1) CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  quote           text NOT NULL,
  image_url       text,
  thumbnail_url   text,                  -- video reviews
  video_url       text,
  video_duration  text,                  -- e.g. '2:45'
  video_title     text,
  is_featured     boolean NOT NULL DEFAULT false, -- homepage StudentSuccess
  sort_order      integer NOT NULL DEFAULT 0,
  status          content_status NOT NULL DEFAULT 'draft',
  published_at    timestamptz,
  review_date     date,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

CREATE INDEX testimonials_type_idx
  ON testimonials (type, published_at DESC)
  WHERE status = 'published' AND deleted_at IS NULL;

COMMENT ON TABLE testimonials IS
  'Unified text + video reviews. Maps to StudentSuccess + /testimonials.';

CREATE TABLE faculty_public (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  name              text NOT NULL,
  specialization    text,
  experience_label  text,                -- e.g. '12+ years'
  hospital          text,
  image_url         text,
  sort_order        integer NOT NULL DEFAULT 0,
  is_published      boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE leadership (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  role        text NOT NULL,
  bio         text,
  image_url   text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faqs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text,
  question    text NOT NULL,
  answer      text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE hero_banners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url   text NOT NULL,
  eyebrow     text,
  title       text NOT NULL,
  subtitle    text,
  cta_label   text,
  cta_href    text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE announcements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message     text NOT NULL,
  href        text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  starts_at   timestamptz,
  ends_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE partners (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  icon        text,
  logo_url    text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE milestones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year_label  text NOT NULL,
  title       text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pillars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text,
  label       text,
  title       text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  kind        text NOT NULL DEFAULT 'pillar', -- pillar | value | principle
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE site_stats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        text,
  value_label text NOT NULL,             -- e.g. '2500', '98'
  suffix      text,                      -- e.g. '+', '%'
  label       text NOT NULL,
  hint        text,
  sort_order  integer NOT NULL DEFAULT 0,
  location    text,                      -- 'home' | 'about' | 'hero'
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url         text NOT NULL,
  alt         text,
  mime_type   text,
  size_bytes  bigint,
  width       integer,
  height      integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOMAIN 10 — Leads & CRM
-- =============================================================================

CREATE TABLE leads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel         lead_channel NOT NULL,
  full_name       text,
  email           text,
  phone           text,
  message         text,
  meta            jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to     uuid REFERENCES users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'new',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enrollment_applications (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id         text UNIQUE,   -- e.g. 'SA-2025-8942'
  lead_id                 uuid REFERENCES leads(id) ON DELETE SET NULL,
  user_id                 uuid REFERENCES users(id) ON DELETE SET NULL,
  -- Personal
  full_name               text NOT NULL,
  guardian_name           text,
  course_preference       text,          -- selected program title
  course_id               uuid REFERENCES courses(id) ON DELETE SET NULL,
  date_of_birth           date,
  gender                  gender_type,
  -- Education / medical
  highest_qualification   text,
  profession              text,
  medical_background      medical_background,
  registration_no         text,
  currently_working       currently_working,
  -- Contact
  whatsapp                text,
  alternate_no            text,
  email                   text NOT NULL,
  address                 text,
  city_state              text,
  pin_code                text,
  source                  text,          -- Instagram / Google / Referral / …
  referral_code           text,          -- student referral code (e.g. AMAN7K)
  use_referral_credit     boolean NOT NULL DEFAULT false,
  -- Modal extras
  preferred_campus_id     uuid REFERENCES campuses(id) ON DELETE SET NULL,
  training_mode           course_mode,
  preferred_batch_id      uuid REFERENCES batches(id) ON DELETE SET NULL,
  payment_option          payment_option,
  -- Custom pathway request (staff builds enrollment_treatments from this)
  requested_treatment_ids uuid[],
  requested_hands_on      jsonb,         -- { treatmentId: boolean }
  quoted_price            numeric(12,2),
  currency                char(3) NOT NULL DEFAULT 'INR',
  -- Uploads
  photo_url               text,
  document_url            text,
  accepted_terms          boolean NOT NULL DEFAULT false,
  status                  application_status NOT NULL DEFAULT 'submitted',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE enrollment_applications IS
  'Full /enroll + EnrollmentModal applications. Staff may customize treatments '
  'and price before converting to an enrollment.';

CREATE TABLE contact_inquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  topic           text,                  -- cosmetology | injectables | lasers | …
  message         text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE newsletter_subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text NOT NULL UNIQUE,
  subscribed_at   timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE TABLE callback_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  full_name       text NOT NULL,
  email           text,
  phone           text NOT NULL,
  item_title      text,
  item_category   text,
  preferred_time  text,
  status          text NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- DOMAIN 11 — Notifications
-- =============================================================================

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        notification_type NOT NULL DEFAULT 'system',
  title       text NOT NULL,
  body        text,
  icon        text,
  color_token text,
  link_url    text,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE TABLE notification_preferences (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled   boolean NOT NULL DEFAULT true,
  push_enabled    boolean NOT NULL DEFAULT true,
  sms_enabled     boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- HELPERS — updated_at trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'oauth_accounts', 'student_profiles', 'instructor_profiles',
    'treatments', 'treatment_stages', 'treatment_videos', 'treatment_booklets',
    'treatment_quizzes', 'quiz_questions',
    'course_categories', 'campuses', 'batches', 'courses', 'course_faqs',
    'enrollments', 'enrollment_treatments', 'enrollment_treatment_stages',
    'notes', 'discussion_posts',
    'assignments', 'assignment_submissions',
    'calendar_events', 'institutional_certificates',
    'payments', 'referrals',
    'blog_posts', 'testimonials', 'faculty_public', 'faqs', 'hero_banners',
    'leads', 'enrollment_applications', 'notification_preferences'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE PROCEDURE set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- =============================================================================
-- BUSINESS RULES (documented; enforce in app + DB checks where noted)
-- =============================================================================
-- 1. Stage order: theory → observation → training → [hands-on if included].
-- 2. Theory completes when required videos done + quiz passed (pass_percent).
-- 3. Completing a stage unlocks the next (enrollment_treatment_stages.status).
-- 4. Progress % = completed stages / eligible stages across enrollment_treatments.
-- 5. Custom enrollment: staff sets enrollment_treatments + agreed_price freely.
-- 6. live_class MUST have treatment_id + meeting_url (DB CHECK).
-- 7. recording_status = ready ⇔ live_class_recording_id set (DB CHECK).
--    Recordings live in live_class_recordings (GCP), not treatment_videos.
--    must match event.treatment_id (trigger). Folder = event.treatment_id.
-- 8. Recurring schedules: set recurrence_rule (RRULE) + series_id; expand to rows
--    (weekly / daily / alternate-day FREQ=DAILY;INTERVAL=2).
-- 9. Small cohorts (e.g. 4 students): use event_registrations / batch_id — no extra table.
-- 10. event_quizzes / event_attachments optional per class.
-- 11. treatment_videos grows as live recordings publish day by day.

COMMENT ON SCHEMA public IS
  'Skinfinity Academy — marketing CMS + treatment-based LMS schema.';

-- =============================================================================
-- COVERAGE MAP (UI / product → tables)
-- =============================================================================
-- Pedagogy (Rohit)
--   treatments, treatment_stages, treatment_videos, treatment_booklets,
--   treatment_quizzes, quiz_questions
--   course_treatments (build course from treatment list)
--   enrollment_treatments.hands_on_included + agreed_price (custom packages)
--   quiz_attempts / video_progress / booklet_progress / enrollment_treatment_stages
--   calendar_events (live_class: treatment_id REQUIRED, meeting_url, recurrence_rule,
--                    series_id, recording_status ↔ live_class_recording_id)
--   live_class_recordings (Zoom→GCP; FK event + treatment)
--   event_quizzes, event_quiz_questions, event_quiz_attempts, event_attachments
--
-- LMS portal
--   /login                  → users, oauth_accounts, sessions
--   /dashboard              → enrollments, enrollment_treatments, learning_stats_daily
--   /dashboard/courses      → enrollments, enrollment_treatments, treatments
--   /course/[id]            → treatments + stages + videos + booklets + notes + discussion
--   /course/.../quiz/...    → treatment_quizzes, quiz_questions, quiz_attempts
--   /dashboard/live         → calendar_events, event_reminders, event_attendance,
--                             event_quizzes, event_attachments, recording → treatment_videos
--   /dashboard/assignments  → assignments, submissions, files, feedback
--   /dashboard/bookmarks    → bookmarks
--   /dashboard/certificates → student_certificates
--   /dashboard/payments     → payments, payment_receipts
--   /dashboard/profile      → student_profiles, user_achievements, learning_stats_daily
--   /dashboard/notifications→ notifications
--   /dashboard/refer        → referral_codes, referrals, referral_wallet_ledger
--
-- Marketing
--   /courses, FeaturedPrograms → courses, course_categories, course_treatments, course_faqs
--   /courses/[slug]            → courses, course_faqs, course_treatments
--   /workshops, /course-calendar → calendar_events, event_registrations
--   /blog                      → blog_posts, blog_categories, blog_tags
--   /testimonials              → testimonials (text + video)
--   /about                     → leadership, milestones, pillars, affiliations, site_stats
--   /contact                   → contact_inquiries, leads
--   /enroll + EnrollmentModal  → enrollment_applications, campuses, batches, callback_requests
--   Certifications section     → institutional_certificates
--   AnnouncementBar / Hero     → announcements, hero_banners
--   Footer newsletter          → newsletter_subscribers
--   Faculty / TrustedBy / FAQ  → faculty_public, partners, faqs
