import { isTableExist } from "./checkTable";
import { createTable } from "./createTable";

export async function checkAndCreateTable(
  tableName: string,
  tableQuery: string,
): Promise<void> {
  const exists = await isTableExist(tableName);
  if (!exists) {
    await createTable(tableQuery);
  }
}
