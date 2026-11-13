/**
 * Build script used by Vercel (`npm run vercel-build`).
 *
 *   1. prisma generate           – always
 *   2. prisma migrate deploy     – only when a database is configured
 *   3. next build                – always
 *
 * If DIRECT_URL isn't set it falls back to DATABASE_URL, so a single connection string
 * is enough. Without any database URL the build still succeeds (migrations are skipped
 * with a warning) — the app then reports a database error at runtime until the
 * variables are added and the project is redeployed.
 */
import { spawnSync } from "node:child_process";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
  console.log("[build] DIRECT_URL not set — using DATABASE_URL for migrations.");
}

run("npx", ["prisma", "generate"]);

if (process.env.DATABASE_URL) {
  console.log("[build] Applying database migrations…");
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.warn(
    "\n[build] WARNING: DATABASE_URL is not set — skipping database migrations.\n" +
      "[build] Add DATABASE_URL (and AUTH_SECRET) in Vercel → Settings → Environment Variables, then redeploy.\n"
  );
  // Prisma validates the schema's env() references on generate/migrate only; placeholders keep `next build` happy.
}

run("npx", ["next", "build"]);
