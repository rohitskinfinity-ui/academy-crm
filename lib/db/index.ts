import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { assertPool, pool } from "./pool";

type MetaResult = {
  insertId: string | null;
  affectedRows: number;
};

type QueryRows<T extends QueryResultRow> = T[] | MetaResult;

async function wrapResult<T extends QueryResultRow>(
  result: QueryResult<T>,
): Promise<[QueryRows<T>, QueryResult<T>["fields"]]> {
  const cmd = (result.command || "").toUpperCase();

  if (
    cmd === "SELECT" ||
    cmd === "SHOW" ||
    (result.rows && result.rows.length > 0)
  ) {
    return [result.rows, result.fields];
  }

  return [
    {
      insertId: (result.rows?.[0] as { id?: string } | undefined)?.id ?? null,
      affectedRows: result.rowCount ?? 0,
    },
    result.fields,
  ];
}

export type DbConnection = {
  query: <T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) => Promise<[QueryRows<T>, QueryResult<T>["fields"]]>;
  beginTransaction: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
  release: () => void;
};

export const db = {
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) {
    const result = await assertPool().query<T>(text, params);
    return wrapResult(result);
  },

  async execute<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ) {
    return db.query<T>(text, params);
  },

  async getConnection(): Promise<DbConnection> {
    const client: PoolClient = await assertPool().connect();

    return {
      async query<T extends QueryResultRow = QueryResultRow>(
        text: string,
        params?: unknown[],
      ) {
        const result = await client.query<T>(text, params);
        return wrapResult(result);
      },

      async beginTransaction() {
        await client.query("BEGIN");
      },

      async commit() {
        await client.query("COMMIT");
      },

      async rollback() {
        await client.query("ROLLBACK");
      },

      release() {
        client.release();
      },
    };
  },

  pool,
};

/** Read id after INSERT ... RETURNING id */
export function getInsertId(
  queryRows: QueryRows<QueryResultRow> | null | undefined,
): string | null {
  if (queryRows == null) return null;
  if (Array.isArray(queryRows)) {
    const id = queryRows[0]?.id;
    return id != null ? String(id) : null;
  }
  if (queryRows.insertId != null) return String(queryRows.insertId);
  return null;
}

export async function withTransaction<T>(
  fn: (conn: DbConnection) => Promise<T>,
): Promise<T> {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
