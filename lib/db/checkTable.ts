import { db } from "./index";

/**
 * Returns false for names starting with `_fn_` so functions/bootstrap SQL
 * re-run on every server start (Skinfinity pattern).
 */
export async function isTableExist(tableName: string): Promise<boolean> {
  if (tableName.startsWith("_fn_")) {
    return false;
  }

  const [rows] = await db.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name = $1
         AND table_type IN ('BASE TABLE', 'VIEW')
     ) AS "exists"`,
    [tableName],
  );

  return Array.isArray(rows) && rows[0]?.exists === true;
}
