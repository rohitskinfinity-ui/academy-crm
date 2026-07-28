import { Pool, types } from "pg";

// Parse int8 (BIGINT) as number
types.setTypeParser(20, (val) => parseInt(val, 10));
// Parse numeric as float
types.setTypeParser(1700, (val) => parseFloat(val));

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

  return {
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: usesSsl ? { rejectUnauthorized: false } : undefined,
  };
}

const poolConfig = buildPoolConfig();

export const pool: Pool | null = poolConfig ? new Pool(poolConfig) : null;

const DB_SCHEMA = process.env.DB_SCHEMA;
if (pool && DB_SCHEMA) {
  pool.on("connect", (client) => {
    void client.query(`SET search_path TO "${DB_SCHEMA}"`);
  });
}

export function assertPool(): Pool {
  if (!pool) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env before using the database.",
    );
  }
  return pool;
}
