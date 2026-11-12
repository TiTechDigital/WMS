import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { HttpError, parseBody, route } from "@/server/http";
import { startSession } from "@/server/auth/session";

const Body = z.object({ login: z.string().trim().min(1).max(120), password: z.string().min(1).max(200) });

// Basic brute-force protection per server instance. For multi-instance deployments use a
// shared store (e.g. Redis / Upstash) — see README "Production checklist".
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 8;
/** Compared against when the account doesn't exist, so response time doesn't reveal valid IDs. */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);
const LOCK_MS = 5 * 60 * 1000;

export const POST = route(async (req) => {
  const { login, password } = await parseBody(req, Body);
  const key = login.toLowerCase();
  const a = attempts.get(key);
  if (a && a.count >= MAX_ATTEMPTS && a.until > Date.now()) {
    throw new HttpError(429, "Too many failed attempts. Wait 5 minutes and try again.");
  }

  const user = await db.user.findFirst({
    where: { OR: [{ login: { equals: login, mode: "insensitive" } }, { email: { equals: login, mode: "insensitive" } }] },
  });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.active) {
    attempts.set(key, { count: (a?.count ?? 0) + 1, until: Date.now() + LOCK_MS });
    throw new HttpError(401, user && ok && !user.active ? "This account is deactivated. Ask an administrator." : "Employee ID or password is incorrect.");
  }
  attempts.delete(key);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user);
  return { ok: true };
});
