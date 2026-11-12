/**
 * Role-based access control, shared by the API (enforcement) and the UI (hiding or
 * disabling actions a user can never perform). The server is always the authority.
 */

export const ROLES = ["admin", "manager", "supervisor", "operator"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrator",
  manager: "Warehouse manager",
  supervisor: "Shift supervisor",
  operator: "Warehouse operator",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  admin: "Full access, including users, sites and system settings.",
  manager: "Runs one or more sites: master data, layout, people, approvals.",
  supervisor: "Runs a shift: releases work, approves adjustments, manages orders.",
  operator: "Executes floor tasks: receiving, picking, packing, counts and moves.",
};

const RANK: Record<Role, number> = { operator: 1, supervisor: 2, manager: 3, admin: 4 };

export type Permission =
  | "data.read"
  | "tasks.execute" // receive, pick, pack, move stock, count
  | "adjustments.request"
  | "adjustments.approve"
  | "inbound.plan" // create ASNs
  | "orders.manage" // create, hold, cancel, prioritise, release waves, ship manifests
  | "transfers.request"
  | "products.manage"
  | "partners.manage" // suppliers, customers
  | "employees.manage"
  | "locations.status" // block / activate / maintenance
  | "locations.manage" // create and delete locations and zones
  | "reports.schedule"
  | "sites.switch"
  | "settings.manage"
  | "users.manage";

const MIN_ROLE: Record<Permission, Role> = {
  "data.read": "operator",
  "tasks.execute": "operator",
  "adjustments.request": "operator",
  "adjustments.approve": "supervisor",
  "inbound.plan": "supervisor",
  "orders.manage": "supervisor",
  "transfers.request": "operator",
  "products.manage": "manager",
  "partners.manage": "manager",
  "employees.manage": "supervisor",
  "locations.status": "supervisor",
  "locations.manage": "manager",
  "reports.schedule": "supervisor",
  "sites.switch": "manager",
  "settings.manage": "admin",
  "users.manage": "admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function can(role: Role | undefined | null, permission: Permission) {
  if (!role) return false;
  return RANK[role] >= RANK[MIN_ROLE[permission]];
}

/** Minimum role needed — used for "Requires …" hints on disabled controls. */
export function requiredRole(permission: Permission): Role {
  return MIN_ROLE[permission];
}

/** Default access level for an employee's job function (used when seeding accounts). */
export function roleForJob(job: string): Role {
  if (job === "Warehouse Manager") return "manager";
  if (job === "Shift Supervisor") return "supervisor";
  return "operator";
}
