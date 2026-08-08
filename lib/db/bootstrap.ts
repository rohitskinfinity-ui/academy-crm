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
        // Tables/functions first, then migrations (ALTER COLUMN), then indexes.
        // Indexes in schema.sql can reference columns that only exist after
        // migrations on an already-provisioned database.
        const schemas = getSchemas();
        const postSchemas = schemas.filter((s) =>
          s.tableName.startsWith("_fn_post_"),
        );
        const coreSchemas = schemas.filter(
          (s) => !s.tableName.startsWith("_fn_post_"),
        );

        for (const { tableName, tableQuery } of coreSchemas) {
          await checkAndCreateTable(tableName, tableQuery);
        }
        console.info("[db] Schema tables checked");

        await runPendingMigrations();

        for (const { tableName, tableQuery } of postSchemas) {
          await checkAndCreateTable(tableName, tableQuery);
        }
        console.info("[db] Schema indexes/triggers checked");

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
