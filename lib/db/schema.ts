import fs from "fs";
import path from "path";

export type SchemaEntry = {
  tableName: string;
  tableQuery: string;
};

/** Table name constants used by services */
export const USERS_TABLE = "users";
export const OAUTH_ACCOUNTS_TABLE = "oauth_accounts";
export const SESSIONS_TABLE = "sessions";
export const STUDENT_PROFILES_TABLE = "student_profiles";
export const INSTRUCTOR_PROFILES_TABLE = "instructor_profiles";
export const TREATMENTS_TABLE = "treatments";
export const TREATMENT_STAGES_TABLE = "treatment_stages";
export const TREATMENT_VIDEOS_TABLE = "treatment_videos";
export const TREATMENT_BOOKLETS_TABLE = "treatment_booklets";
export const TREATMENT_QUIZZES_TABLE = "treatment_quizzes";
export const QUIZ_QUESTIONS_TABLE = "quiz_questions";
export const COURSE_CATEGORIES_TABLE = "course_categories";
export const CAMPUSES_TABLE = "campuses";
export const BATCHES_TABLE = "batches";
export const COURSES_TABLE = "courses";
export const COURSE_TREATMENTS_TABLE = "course_treatments";
export const COURSE_FAQS_TABLE = "course_faqs";
export const COURSE_NAV_ITEMS_TABLE = "course_nav_items";
export const ENROLLMENTS_TABLE = "enrollments";
export const ENROLLMENT_TREATMENTS_TABLE = "enrollment_treatments";
export const ENROLLMENT_TREATMENT_STAGES_TABLE = "enrollment_treatment_stages";
export const VIDEO_PROGRESS_TABLE = "video_progress";
export const QUIZ_ATTEMPTS_TABLE = "quiz_attempts";
export const CALENDAR_EVENTS_TABLE = "calendar_events";
export const LIVE_CLASS_RECORDINGS_TABLE = "live_class_recordings";
export const EVENT_ATTENDANCE_TABLE = "event_attendance";
export const STUDENT_CERTIFICATES_TABLE = "student_certificates";
export const ENROLLMENT_APPLICATIONS_TABLE = "enrollment_applications";

const TABLE_ORDER = [
  "users",
  "oauth_accounts",
  "sessions",
  "student_profiles",
  "instructor_profiles",
  "treatments",
  "treatment_stages",
  "treatment_videos",
  "treatment_booklets",
  "treatment_quizzes",
  "quiz_questions",
  "course_categories",
  "campuses",
  "batches",
  "courses",
  "course_treatments",
  "course_faqs",
  "course_nav_items",
  "enrollments",
  "enrollment_treatments",
  "enrollment_treatment_stages",
  "video_progress",
  "booklet_progress",
  "quiz_attempts",
  "bookmarks",
  "notes",
  "discussion_posts",
  "learning_stats_daily",
  "achievements",
  "user_achievements",
  "assignments",
  "assignment_targets",
  "assignment_submissions",
  "assignment_files",
  "assignment_feedback",
  "calendar_events",
  "live_class_recordings",
  "event_registrations",
  "event_reminders",
  "event_attendance",
  "event_quizzes",
  "event_quiz_questions",
  "event_quiz_attempts",
  "event_attachments",
  "student_certificates",
  "institutional_certificates",
  "affiliations",
  "payments",
  "payment_receipts",
  "referral_codes",
  "referrals",
  "blog_categories",
  "blog_posts",
  "blog_tags",
  "blog_post_tags",
  "testimonials",
  "faculty_public",
  "leadership",
  "faqs",
  "hero_banners",
  "announcements",
  "partners",
  "milestones",
  "pillars",
  "site_stats",
  "media_assets",
  "leads",
  "enrollment_applications",
  "contact_inquiries",
  "newsletter_subscribers",
  "callback_requests",
  "notifications",
  "notification_preferences",
] as const;

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "");
}

function splitStatements(sql: string): string[] {
  const cleaned = stripComments(sql);
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let dollarTag: string | null = null;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (dollarTag) {
      if (cleaned.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length - 1;
        dollarTag = null;
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === "'" && !inSingle) {
      inSingle = true;
      current += ch;
      continue;
    }
    if (ch === "'" && inSingle) {
      // escaped ''
      if (cleaned[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }
      inSingle = false;
      current += ch;
      continue;
    }

    if (!inSingle && ch === "$") {
      const rest = cleaned.slice(i);
      const match = rest.match(/^\$([A-Za-z_]*)\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (!inSingle && ch === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) statements.push(trimmed);
  return statements;
}

function wrapCreateType(statement: string): string {
  const match = statement.match(
    /^CREATE\s+TYPE\s+([a-zA-Z0-9_]+)\s+AS\s+ENUM\s*\(([\s\S]*)\)\s*$/i,
  );
  if (!match) return statement;
  const [, typeName, values] = match;
  return `DO $$ BEGIN
  CREATE TYPE ${typeName} AS ENUM (${values});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$`;
}

function makeCreateTableIfNotExists(statement: string): string {
  return statement.replace(
    /^CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i,
    "CREATE TABLE IF NOT EXISTS ",
  );
}

function makeCreateIndexIfNotExists(statement: string): string {
  return statement.replace(
    /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)/i,
    (_m, unique) =>
      `CREATE ${unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS `,
  );
}

function makeSafeAlterConstraint(statement: string): string {
  // ALTER TABLE batches ADD CONSTRAINT ...
  const match = statement.match(
    /^ALTER\s+TABLE\s+(\w+)\s+ADD\s+CONSTRAINT\s+(\w+)\s+([\s\S]+)$/i,
  );
  if (!match) return statement;
  const [, table, constraint, rest] = match;
  return `DO $$ BEGIN
  ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${rest};
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$`;
}

function makeSafeTriggerBlock(statement: string): string {
  // The schema uses a DO block that CREATE TRIGGER without IF NOT EXISTS.
  // Re-run safely by dropping then recreating inside the loop is heavy;
  // wrap each CREATE TRIGGER via replacing the EXECUTE format call pattern
  // is fragile — instead wrap the whole DO in exception-safe trigger create.
  if (!/CREATE TRIGGER trg_/i.test(statement)) return statement;

  return statement.replace(
    /EXECUTE format\(\s*'CREATE TRIGGER trg_%s_updated_at\s+BEFORE UPDATE ON %I\s+FOR EACH ROW EXECUTE PROCEDURE set_updated_at\(\)',\s*t, t\s*\)/i,
    `EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I;
       CREATE TRIGGER trg_%s_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE PROCEDURE set_updated_at()',
      t, t, t, t
    )`,
  );
}

function extractTableName(statement: string): string | null {
  const m = statement.match(/^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  return m?.[1]?.toLowerCase() ?? null;
}

/**
 * Build SCHEMAS from database/schema.sql (Skinfinity-style create-if-missing).
 * Extensions/enums/functions use `_fn_` prefix so they re-apply every boot.
 */
export function buildSchemasFromSqlFile(): SchemaEntry[] {
  const schemaPath = path.join(process.cwd(), "database", "schema.sql");
  const raw = fs.readFileSync(schemaPath, "utf-8");
  const statements = splitStatements(raw);

  const entries: SchemaEntry[] = [];
  const tableQueries = new Map<string, string[]>();
  const bootstrap: string[] = [];
  const postTables: string[] = [];

  for (const stmt of statements) {
    const upper = stmt.toUpperCase();

    if (upper.startsWith("CREATE EXTENSION")) {
      bootstrap.push(
        stmt.replace(
          /^CREATE\s+EXTENSION\s+(?!IF\s+NOT\s+EXISTS)/i,
          "CREATE EXTENSION IF NOT EXISTS ",
        ),
      );
      continue;
    }

    if (upper.startsWith("CREATE TYPE")) {
      bootstrap.push(wrapCreateType(stmt));
      continue;
    }

    if (upper.startsWith("CREATE OR REPLACE FUNCTION")) {
      bootstrap.push(stmt);
      continue;
    }

    if (upper.startsWith("CREATE TABLE")) {
      const name = extractTableName(stmt);
      if (!name) continue;
      const q = makeCreateTableIfNotExists(stmt);
      const list = tableQueries.get(name) ?? [];
      list.push(q);
      tableQueries.set(name, list);
      continue;
    }

    if (upper.startsWith("CREATE") && upper.includes(" INDEX ")) {
      postTables.push(makeCreateIndexIfNotExists(stmt));
      continue;
    }

    if (upper.startsWith("ALTER TABLE")) {
      postTables.push(makeSafeAlterConstraint(stmt));
      continue;
    }

    if (upper.startsWith("DO $$") || upper.startsWith("DO $")) {
      postTables.push(makeSafeTriggerBlock(stmt));
      continue;
    }

    if (upper.startsWith("COMMENT ON")) {
      postTables.push(stmt);
      continue;
    }
  }

  if (bootstrap.length > 0) {
    entries.push({
      tableName: "_fn_bootstrap_extensions_enums_functions",
      tableQuery: bootstrap.join(";\n") + ";",
    });
  }

  for (const name of TABLE_ORDER) {
    const parts = tableQueries.get(name);
    if (!parts) continue;
    entries.push({
      tableName: name,
      tableQuery: parts.join(";\n") + ";",
    });
    tableQueries.delete(name);
  }

  // Any remaining tables not in TABLE_ORDER
  for (const [name, parts] of tableQueries) {
    entries.push({
      tableName: name,
      tableQuery: parts.join(";\n") + ";",
    });
  }

  if (postTables.length > 0) {
    entries.push({
      tableName: "_fn_post_indexes_triggers_comments",
      tableQuery: postTables.join(";\n") + ";",
    });
  }

  return entries;
}

let cachedSchemas: SchemaEntry[] | null = null;

export function getSchemas(): SchemaEntry[] {
  if (!cachedSchemas) {
    cachedSchemas = buildSchemasFromSqlFile();
  }
  return cachedSchemas;
}

/** Alias matching Skinfinity `SCHEMAS` export style */
export const SCHEMAS = {
  get entries() {
    return getSchemas();
  },
};
