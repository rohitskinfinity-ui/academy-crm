import fs from "fs";
import path from "path";
import { db } from "./index";

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");
const TRACKING_TABLE = "_migrations";

async function ensureTrackingTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await baselineIfNeeded();
}

async function baselineIfNeeded() {
  const [countRows] = await db.query<{ cnt: string }>(
    `SELECT COUNT(*)::text AS cnt FROM ${TRACKING_TABLE}`,
  );
  const count = Array.isArray(countRows)
    ? parseInt(countRows[0]?.cnt ?? "0", 10)
    : 0;
  if (count > 0) return;

  const [tableRows] = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = current_schema() AND table_name = 'users'
     ) AS "exists"`,
  );

  if (Array.isArray(tableRows) && tableRows[0]?.exists === true) {
    await db.query(
      `INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
      ["001_initial_schema.sql"],
    );
    console.info("[db] Baselined 001_initial_schema.sql (tables already exist)");
  }
}

async function getExecutedMigrations(): Promise<Set<string>> {
  const [rows] = await db.query<{ filename: string }>(
    `SELECT filename FROM ${TRACKING_TABLE} ORDER BY filename`,
  );
  if (!Array.isArray(rows)) return new Set();
  return new Set(rows.map((r) => r.filename));
}

function getPendingMigrations(executed: Set<string>): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];

  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !executed.has(f));
}

async function runMigration(filename: string) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  let sql = fs.readFileSync(filePath, "utf-8").trim();

  // Strip outer BEGIN/COMMIT if present — we wrap it ourselves
  sql = sql.replace(/^\s*BEGIN\s*;\s*/i, "").replace(/\s*COMMIT\s*;\s*$/i, "");

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(sql);
    await conn.query(`INSERT INTO ${TRACKING_TABLE} (filename) VALUES ($1)`, [
      filename,
    ]);
    await conn.commit();
    console.info(`[db] Migration executed: ${filename}`);
  } catch (err) {
    await conn.rollback();
    console.error(`[db] Migration failed: ${filename}`, err);
    throw err;
  } finally {
    conn.release();
  }
}

export async function runPendingMigrations() {
  await ensureTrackingTable();
  const executed = await getExecutedMigrations();
  const pending = getPendingMigrations(executed);

  if (pending.length === 0) {
    console.info("[db] No pending migrations");
    return;
  }

  console.info(
    `[db] Found ${pending.length} pending migration(s): ${pending.join(", ")}`,
  );

  for (const filename of pending) {
    await runMigration(filename);
  }

  console.info("[db] All migrations completed");
}
