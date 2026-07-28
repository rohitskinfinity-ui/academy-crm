export async function register() {
  // Only run DB bootstrap in the Node.js runtime (not Edge).
  if (process.env.NEXT_RUNTIME === "edge") return;

  // Skip during `next build` when DATABASE_URL may be absent.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  if (!process.env.DATABASE_URL) {
    console.warn("[instrumentation] DATABASE_URL not set; skipping DB bootstrap");
    return;
  }

  try {
    const { ensureDatabase } = await import("@/lib/db/bootstrap");
    await ensureDatabase();
  } catch (err) {
    // Do not crash the Next.js process if DB is unreachable / misconfigured.
    console.error(
      "[instrumentation] DB bootstrap failed — fix DATABASE_URL and restart (or run npm run db:migrate)",
      err,
    );
  }
}
