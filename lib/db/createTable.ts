import { db } from "./index";

export async function createTable(createQuery: string): Promise<void> {
  await db.query(createQuery);
}
