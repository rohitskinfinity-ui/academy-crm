import { Pool, types } from "pg";

// Parse int8 (BIGINT) as number
types.setTypeParser(20, (val) => parseInt(val, 10));
// Parse numeric as float
types.setTypeParser(1700, (val) => parseFloat(val));

const globalForPool = globalThis as typeof globalThis & {
  __academyPgPool?: Pool | null;
};

function parsePoolMax(): number {
  const raw = process.env.DB_POOL_MAX;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 20);
  }
  // Cloud SQL small instances have very few slots; keep this low per process.
  return process.env.NODE_ENV === "production" ? 10 : 5;
}

function buildPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return null;
  }

  const usesSsl =
    databaseUrl.includes("sslmode=require") ||
    databaseUrl.includes("sslmode=prefer") ||
    databaseUrl.includes("sslmode=verify");

  // pg 8.x treats sslmode=require as verify-full unless uselibpqcompat=true.
  let connectionString = databaseUrl;
  if (usesSsl && !databaseUrl.includes("uselibpqcompat=true")) {
    connectionString = databaseUrl.includes("?")
      ? `${databaseUrl}&uselibpqcompat=true`
      : `${databaseUrl}?uselibpqcompat=true`;
  }

  // Prefer search_path via startup options (avoids racing query on connect).
  const DB_SCHEMA = process.env.DB_SCHEMA;
  if (DB_SCHEMA && !connectionString.includes("options=")) {
    const opt = encodeURIComponent(`-csearch_path=${DB_SCHEMA}`);
    connectionString += `&options=${opt}`;
  }

  return {
    connectionString,
    max: parsePoolMax(),
    idleTimeoutMillis: 10_000,
    // Cloud SQL can be slow to accept new connections from some networks
    connectionTimeoutMillis: 20_000,
    keepAlive: true,
    application_name: process.env.DB_APPLICATION_NAME || "academy-crm",
    ssl: usesSsl ? { rejectUnauthorized: false } : undefined,
  };
}

function getOrCreatePool(): Pool | null {
  if (globalForPool.__academyPgPool !== undefined) {
    return globalForPool.__academyPgPool;
  }

  const poolConfig = buildPoolConfig();
  const created = poolConfig ? new Pool(poolConfig) : null;
  if (created) {
    created.on("error", (err) => {
      console.error("[db] idle client error", err);
    });
  }

  globalForPool.__academyPgPool = created;
  return created;
}

export const pool: Pool | null = getOrCreatePool();

export function assertPool(): Pool {
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env before using the database.",
    );
  }
  return pool;
}
