import { db } from "@/server/db";
import { route } from "@/server/http";

/** Liveness + database connectivity check (public). */
export const GET = route(async () => {
  await db.$queryRaw`SELECT 1`;
  return { ok: true, database: "connected", time: new Date().toISOString() };
});
