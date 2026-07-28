import "dotenv/config";
import { ensureDatabase } from "../lib/db/bootstrap";

async function main() {
  await ensureDatabase();
  console.info("db:migrate completed");
  process.exit(0);
}

main().catch((err) => {
  console.error("db:migrate failed", err);
  process.exit(1);
});
