import "server-only";
import { cookies } from "next/headers";
import { db } from "../db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession } from "./token";
import { can, isRole, type Permission, type Role } from "@/lib/permissions";
import { HttpError } from "../http";

export interface CurrentUser {
  id: string;
  login: string;
  name: string;
  email: string;
  role: Role;
  warehouseId: string | null;
  employeeId: string | null;
  profile: Record<string, unknown>;
}

/**
 * Resolve the signed-in user. The token proves identity; the database is re-checked on
 * every request so deactivated users and role changes take effect immediately.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const claims = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await db.user.findUnique({ where: { id: claims.sub } });
  if (!user || !user.active || !isRole(user.role)) return null;
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    email: user.email,
    role: user.role,
    warehouseId: user.warehouseId,
    employeeId: user.employeeId,
    profile: (user.profile ?? {}) as Record<string, unknown>,
  };
}

export async function requireUser(permission: Permission = "data.read"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "You need to sign in.");
  if (!can(user.role, permission)) throw new HttpError(403, "Your role doesn't allow this action.");
  return user;
}

/** Users who can't switch sites are restricted to their home warehouse. */
export function assertSiteAccess(user: CurrentUser, warehouseId: string) {
  if (can(user.role, "sites.switch")) return;
  if (user.warehouseId && user.warehouseId !== warehouseId) {
    throw new HttpError(403, "You only have access to your home site.");
  }
}

export async function startSession(user: { id: string; role: string; name: string }) {
  const token = await signSession({ sub: user.id, role: user.role, name: user.name });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
