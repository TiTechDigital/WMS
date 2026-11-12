import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { HttpError } from "../http";
import type { CurrentUser } from "../auth/session";
import { assertSiteAccess } from "../auth/session";
import { conflict, logActivity, nextNumber, notFound } from "./common";
import type { Role } from "@/lib/permissions";

const homeSite = async (user: CurrentUser) => user.warehouseId ?? (await db.warehouse.findFirst({ orderBy: { createdAt: "asc" } }))?.id ?? "WH-ATL";

/* ───────────────────────────── Products ───────────────────────────── */

export interface ProductInput {
  sku: string; name: string; barcode: string; category: string; brand: string; description: string; uom: string; unitsPerCase: number;
  weightKg: number; dimensions: { length: number; width: number; height: number }; minStock: number; maxStock: number; reorderQty: number;
  supplierId: string; unitCost: number; unitPrice: number; storage: string; status: string; imageUrl?: string | null;
}

function productData(p: ProductInput) {
  const { dimensions, ...rest } = p;
  return { ...rest, imageUrl: p.imageUrl ?? null, lengthCm: dimensions.length, widthCm: dimensions.width, heightCm: dimensions.height };
}

export async function saveProduct(user: CurrentUser, id: string | null, input: ProductInput) {
  if (input.maxStock <= input.minStock) throw new HttpError(400, "Maximum stock must be greater than minimum stock.");
  return db.$transaction(async (tx) => {
    const dup = await tx.product.findFirst({ where: { sku: input.sku, ...(id ? { NOT: { id } } : {}) } });
    if (dup) conflict(`SKU ${input.sku} already exists.`);
    if (!(await tx.supplier.findUnique({ where: { id: input.supplierId } }))) throw new HttpError(400, "Supplier doesn't exist.");
    const saved = id
      ? await tx.product.update({ where: { id }, data: productData(input) })
      : await tx.product.create({ data: { id: `prd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, ...productData(input) } });
    await logActivity(tx, user, await homeSite(user), { module: "Products", action: id ? "Product updated" : "Product created", entity: saved.sku, details: saved.name });
    return { id: saved.id };
  });
}

/* ───────────────────────────── Partners ───────────────────────────── */

export async function saveSupplier(user: CurrentUser, id: string | null, input: Omit<Prisma.SupplierUncheckedCreateInput, "id" | "code"> & { code?: string }) {
  return db.$transaction(async (tx) => {
    const code = input.code ?? (await nextNumber(tx, "SUP"));
    const saved = id
      ? await tx.supplier.update({ where: { id }, data: { ...input, code: undefined } })
      : await tx.supplier.create({ data: { ...input, id: `sup_${Date.now().toString(36)}`, code } });
    await logActivity(tx, user, await homeSite(user), { module: "System", action: id ? "Supplier updated" : "Supplier created", entity: saved.code, details: saved.name });
    return { id: saved.id };
  });
}

export async function saveCustomer(user: CurrentUser, id: string | null, input: Omit<Prisma.CustomerUncheckedCreateInput, "id" | "code">) {
  return db.$transaction(async (tx) => {
    const saved = id
      ? await tx.customer.update({ where: { id }, data: input })
      : await tx.customer.create({ data: { ...input, id: `cus_${Date.now().toString(36)}`, code: await nextNumber(tx, "CUS") } });
    await logActivity(tx, user, await homeSite(user), { module: "System", action: id ? "Customer updated" : "Customer created", entity: saved.code, details: saved.name });
    return { id: saved.id };
  });
}

/* ───────────────────────────── Employees ───────────────────────────── */

export async function createEmployee(user: CurrentUser, input: { name: string; role: string; shift: string; zone: string; warehouseId: string }) {
  assertSiteAccess(user, input.warehouseId);
  return db.$transaction(async (tx) => {
    const n = await nextNumber(tx, "BADGE", "B");
    const badge = `${input.warehouseId.replace(/^WH-/, "")}-${n.replace("B-", "")}`;
    const floor = ["Picker", "Packer", "Receiver", "Forklift Operator"].includes(input.role);
    const e = await tx.employee.create({
      data: {
        id: `emp_${Date.now().toString(36)}`, badge, name: input.name,
        email: `${input.name.toLowerCase().replace(/[^a-z ]/g, "").trim().replace(/\s+/g, ".")}@northstar-logistics.com`,
        role: input.role, warehouseId: input.warehouseId, shift: input.shift, zone: input.zone, status: "off_shift",
        certifications: [], device: floor ? `RF-${300 + (Number(n.replace(/\D/g, "")) % 600)}` : null,
      },
    });
    await logActivity(tx, user, input.warehouseId, { module: "Users", action: "Operator added", entity: badge, details: `${e.name} · ${e.role}` });
    return { id: e.id, badge };
  });
}

export async function setEmployeeStatus(user: CurrentUser, id: string, status: string) {
  return db.$transaction(async (tx) => {
    const e = (await tx.employee.findUnique({ where: { id } })) ?? notFound("Operator");
    assertSiteAccess(user, e.warehouseId);
    await tx.employee.update({ where: { id }, data: { status } });
    await logActivity(tx, user, e.warehouseId, { module: "Users", action: "Operator status changed", entity: e.badge, details: `${e.name} → ${status.replace("_", " ")}` });
    return { ok: true };
  });
}

/* ───────────────────────────── Locations ───────────────────────────── */

export async function setLocationStatus(user: CurrentUser, ids: string[], status: string) {
  return db.$transaction(async (tx) => {
    const locs = await tx.location.findMany({ where: { id: { in: ids } } });
    for (const l of locs) {
      assertSiteAccess(user, l.warehouseId);
      await tx.location.update({ where: { id: l.id }, data: { status } });
      await logActivity(tx, user, l.warehouseId, {
        module: "Locations",
        action: `Location ${status === "active" ? "activated" : status}`,
        entity: l.code,
        details: `Status set to ${status}`,
        severity: status === "active" ? "info" : "warning",
      });
    }
    return { count: locs.length };
  });
}

const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Bulk-create storage positions: every combination of aisle × rack × level in a zone,
 * coded <SITE>-<ZONE>-<AISLE>-<RACK>-<LEVEL>-<BIN>. Existing codes are skipped.
 */
export async function createLocations(
  user: CurrentUser,
  input: {
    warehouseId: string;
    zone: { code: string; name: string; type: string; temperature?: string };
    aisles: [number, number];
    racks: [number, number];
    levels: string[];
    binsPerLevel: number;
    capacity: number;
  }
) {
  assertSiteAccess(user, input.warehouseId);
  const count = (input.aisles[1] - input.aisles[0] + 1) * (input.racks[1] - input.racks[0] + 1) * input.levels.length * input.binsPerLevel;
  if (count <= 0) throw new HttpError(400, "The ranges don't produce any locations.");
  if (count > 5000) throw new HttpError(400, `That would create ${count} locations. Create at most 5,000 at a time.`);
  return db.$transaction(
    async (tx) => {
      const site = input.warehouseId.replace(/^WH-/, "");
      await tx.zone.upsert({
        where: { warehouseId_code: { warehouseId: input.warehouseId, code: input.zone.code } },
        create: { id: `${input.warehouseId}-${input.zone.code}`, warehouseId: input.warehouseId, code: input.zone.code, name: input.zone.name, type: input.zone.type, temperature: input.zone.temperature || null },
        update: {},
      });
      const data: Prisma.LocationCreateManyInput[] = [];
      for (let a = input.aisles[0]; a <= input.aisles[1]; a++)
        for (let r = input.racks[0]; r <= input.racks[1]; r++)
          for (const lv of input.levels)
            for (let b = 1; b <= input.binsPerLevel; b++) {
              const code = `${site}-${input.zone.code}-${p2(a)}-${p2(r)}-${lv}-${p2(b)}`;
              data.push({
                id: `loc_${code}`, code, warehouseId: input.warehouseId, zone: input.zone.code, aisle: p2(a), rack: p2(r), shelf: lv, bin: p2(b),
                type: input.zone.type, capacity: input.capacity, occupied: 0, status: "active",
              });
            }
      const res = await tx.location.createMany({ data, skipDuplicates: true });
      await logActivity(tx, user, input.warehouseId, {
        module: "Locations",
        action: "Locations created",
        entity: `Zone ${input.zone.code}`,
        details: `${res.count} new positions (${data.length - res.count} already existed)`,
        severity: "success",
      });
      return { created: res.count, skipped: data.length - res.count };
    },
    { timeout: 30_000 }
  );
}

export async function deleteLocations(user: CurrentUser, ids: string[]) {
  return db.$transaction(async (tx) => {
    const locs = await tx.location.findMany({ where: { id: { in: ids } } });
    const blocked: string[] = [];
    let deleted = 0;
    for (const l of locs) {
      assertSiteAccess(user, l.warehouseId);
      const stock = await tx.inventoryRecord.count({ where: { warehouseId: l.warehouseId, locationCode: l.code, total: { gt: 0 } } });
      if (stock || l.occupied > 0) {
        blocked.push(l.code);
        continue;
      }
      await tx.inventoryRecord.deleteMany({ where: { warehouseId: l.warehouseId, locationCode: l.code } });
      await tx.location.delete({ where: { id: l.id } });
      await logActivity(tx, user, l.warehouseId, { module: "Locations", action: "Location deleted", entity: l.code, details: "Empty location removed", severity: "warning" });
      deleted++;
    }
    return { deleted, blocked };
  });
}

/* ───────────────────────────── Sites ───────────────────────────── */

export async function createWarehouse(user: CurrentUser, input: { id: string; name: string; city: string; timezone: string }) {
  return db.$transaction(async (tx) => {
    if (await tx.warehouse.findUnique({ where: { id: input.id } })) conflict(`Site ${input.id} already exists.`);
    await tx.warehouse.create({ data: { ...input, stockLevelFactor: 1 } });
    await logActivity(tx, user, input.id, { module: "System", action: "Site created", entity: input.id, details: `${input.name} · ${input.city}`, severity: "success" });
    return { id: input.id };
  });
}

/* ───────────────────────────── Users ───────────────────────────── */

export async function createUser(admin: CurrentUser, input: { login: string; email: string; name: string; role: Role; warehouseId: string | null; password: string }) {
  return db.$transaction(async (tx) => {
    const exists = await tx.user.findFirst({ where: { OR: [{ login: { equals: input.login, mode: "insensitive" } }, { email: { equals: input.email, mode: "insensitive" } }] } });
    if (exists) conflict("A user with this employee ID or email already exists.");
    const employee = await tx.employee.findFirst({ where: { badge: input.login } });
    const u = await tx.user.create({
      data: {
        login: input.login, email: input.email, name: input.name, role: input.role, warehouseId: input.warehouseId,
        employeeId: employee && !(await tx.user.findFirst({ where: { employeeId: employee.id } })) ? employee.id : null,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });
    await logActivity(tx, admin, input.warehouseId ?? (await homeSite(admin)), { module: "Users", action: "User created", entity: u.login, details: `${u.name} · ${input.role}`, severity: "warning" });
    return { id: u.id };
  });
}

export async function updateUser(admin: CurrentUser, id: string, input: { name?: string; email?: string; role?: Role; warehouseId?: string | null; active?: boolean; password?: string }) {
  if (id === admin.id && (input.role && input.role !== "admin" || input.active === false)) {
    throw new HttpError(400, "You can't remove your own administrator access. Ask another administrator.");
  }
  return db.$transaction(async (tx) => {
    const u = (await tx.user.findUnique({ where: { id } })) ?? notFound("User");
    const { password, ...rest } = input;
    await tx.user.update({ where: { id }, data: { ...rest, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } });
    const changes = [input.role && `role → ${input.role}`, input.active !== undefined && (input.active ? "activated" : "deactivated"), password && "password reset"].filter(Boolean).join(", ");
    await logActivity(tx, admin, u.warehouseId ?? (await homeSite(admin)), { module: "Users", action: "User updated", entity: u.login, details: changes || "Profile updated", severity: "warning" });
    return { ok: true };
  });
}

export async function updateProfile(user: CurrentUser, input: { name?: string; email?: string; phone?: string; language?: string; currentPassword?: string; newPassword?: string }) {
  const u = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  const data: Prisma.UserUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.email && input.email !== u.email) {
    if (await db.user.findFirst({ where: { email: { equals: input.email, mode: "insensitive" }, NOT: { id: u.id } } })) conflict("That email is already in use.");
    data.email = input.email;
  }
  if (input.phone !== undefined || input.language !== undefined) {
    data.profile = { ...((u.profile as object) ?? {}), ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(input.language !== undefined ? { language: input.language } : {}) };
  }
  if (input.newPassword) {
    if (!input.currentPassword || !(await bcrypt.compare(input.currentPassword, u.passwordHash))) throw new HttpError(400, "Current password is incorrect.");
    data.passwordHash = await bcrypt.hash(input.newPassword, 12);
  }
  await db.user.update({ where: { id: u.id }, data });
  return { ok: true };
}

/* ───────────────────────────── Settings, schedules, notifications, log ───────────────────────────── */

export async function putSetting(user: CurrentUser, key: string, value: Prisma.InputJsonValue) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
  await db.$transaction((tx) => logActivity(tx, user, user.warehouseId ?? "WH-ATL", { module: "System", action: "Settings updated", entity: key, details: "Configuration saved" })).catch(() => undefined);
  return { ok: true };
}

export async function logClientEvent(user: CurrentUser, warehouseId: string, e: { module: string; action: string; entity: string; details: string; severity?: "info" | "success" | "warning" | "critical"; source?: "Web" | "RF Scanner" }) {
  assertSiteAccess(user, warehouseId);
  await db.$transaction((tx) => logActivity(tx, user, warehouseId, e));
  return { ok: true };
}

export async function markNotifications(user: CurrentUser, ids: string[] | "all") {
  await db.notification.updateMany({ where: { ...(ids === "all" ? {} : { id: { in: ids } }), OR: [{ userId: null }, { userId: user.id }] }, data: { read: true } });
  return { ok: true };
}

export async function dismissNotification(user: CurrentUser, id: string) {
  await db.notification.deleteMany({ where: { id, OR: [{ userId: null }, { userId: user.id }] } });
  return { ok: true };
}
