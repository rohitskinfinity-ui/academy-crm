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

    const maxAttempts = 3;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.info(
          `[db] Running schema check${attempt > 1 ? ` (retry ${attempt}/${maxAttempts})` : ""}...`,
        );
        for (const { tableName, tableQuery } of getSchemas()) {
          await checkAndCreateTable(tableName, tableQuery);
        }
        console.info("[db] Schema tables checked");

        await runPendingMigrations();
        await seedAdmin();

        bootstrapped = true;
        console.info("[db] Database ready");
        return;
      } catch (err) {
        lastErr = err;
        console.error(`[db] Bootstrap failed (attempt ${attempt})`, err);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
      }
    }

    bootstrapPromise = null;
    throw lastErr;
  })();

  return bootstrapPromise;
}
