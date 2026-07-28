import { checkAndCreateTable } from "./checkAndCreateTable";
import { runPendingMigrations } from "./migrationRunner";
import { pool } from "./pool";
import { getSchemas } from "./schema";
import { seedAdmin } from "./seedAdmin";

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

export async function ensureDatabase(): Promise<void> {
  if (bootstrapped) return;
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    if (!pool) {
      console.warn(
        "[db] Skipping schema bootstrap: DATABASE_URL is not set",
      );
      return;
    }

    try {
      console.info("[db] Running schema check...");
      for (const { tableName, tableQuery } of getSchemas()) {
        await checkAndCreateTable(tableName, tableQuery);
      }
      console.info("[db] Schema tables checked");

      await runPendingMigrations();
      await seedAdmin();

      bootstrapped = true;
      console.info("[db] Database ready");
    } catch (err) {
      bootstrapPromise = null;
      console.error("[db] Bootstrap failed", err);
      throw err;
    }
  })();

  return bootstrapPromise;
}
