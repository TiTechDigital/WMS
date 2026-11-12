import "server-only";
import { db } from "./db";
import * as S from "./serialize";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "./auth/session";

export const COLLECTIONS = [
  "warehouses", "zones", "locations", "inventory", "products", "suppliers", "customers", "employees",
  "inbound", "orders", "pickTasks", "transfers", "adjustments", "activity", "notifications", "metrics",
  "settings", "reportSchedules", "users",
] as const;
export type Collection = (typeof COLLECTIONS)[number];

/** How many audit events to ship to the client per site (older ones stay queryable in the DB). */
const ACTIVITY_LIMIT = 1500;

/**
 * Loads the requested collections for the signed-in user. Users without the
 * `sites.switch` permission only receive data for their home warehouse.
 */
export async function loadCollections(user: CurrentUser, wanted: readonly Collection[]) {
  const scoped = can(user.role, "sites.switch") || !user.warehouseId ? {} : { warehouseId: user.warehouseId };
  const out: Partial<Record<Collection, unknown>> = {};

  await Promise.all(
    wanted.map(async (c) => {
      switch (c) {
        case "warehouses": {
          const rows = await db.warehouse.findMany({ where: { active: true, ...(scoped.warehouseId ? { id: scoped.warehouseId } : {}) }, orderBy: { createdAt: "asc" } });
          out.warehouses = rows.map(S.toWarehouse);
          break;
        }
        case "zones":
          out.zones = (await db.zone.findMany({ where: scoped, orderBy: [{ warehouseId: "asc" }, { code: "asc" }] })).map(S.toZone);
          break;
        case "locations": {
          const [locs, inv] = await Promise.all([
            db.location.findMany({ where: scoped, orderBy: { code: "asc" } }),
            db.inventoryRecord.findMany({ where: scoped, select: { locationId: true, productId: true } }),
          ]);
          const byLoc = new Map<string, string[]>();
          inv.forEach((r) => byLoc.set(r.locationId, [...(byLoc.get(r.locationId) ?? []), r.productId]));
          out.locations = locs.map((l) => S.toLocation(l, byLoc.get(l.id) ?? []));
          break;
        }
        case "inventory": {
          const rows = await db.inventoryRecord.findMany({ where: scoped, include: { product: { select: { sku: true, name: true, category: true } } } });
          out.inventory = rows.map(S.toInventory);
          break;
        }
        case "products":
          out.products = (await db.product.findMany({ orderBy: { sku: "asc" } })).map(S.toProduct);
          break;
        case "suppliers":
          out.suppliers = (await db.supplier.findMany({ orderBy: { name: "asc" } })).map(S.toSupplier);
          break;
        case "customers":
          out.customers = (await db.customer.findMany({ orderBy: { name: "asc" } })).map(S.toCustomer);
          break;
        case "employees":
          out.employees = (await db.employee.findMany({ where: scoped, orderBy: { name: "asc" } })).map(S.toEmployee);
          break;
        case "inbound":
          out.inbound = (await db.inboundShipment.findMany({ where: scoped, include: { lines: true }, orderBy: { expectedAt: "asc" } })).map(S.toInbound);
          break;
        case "orders":
          out.orders = (await db.order.findMany({ where: scoped, include: { lines: true }, orderBy: { createdAt: "desc" } })).map(S.toOrder);
          break;
        case "pickTasks":
          out.pickTasks = (await db.pickTask.findMany({ where: scoped, include: { lines: true }, orderBy: { createdAt: "desc" } })).map(S.toPickTask);
          break;
        case "transfers":
          out.transfers = (await db.stockTransfer.findMany({ where: scoped, include: { lines: true }, orderBy: { createdAt: "desc" } })).map(S.toTransfer);
          break;
        case "adjustments":
          out.adjustments = (await db.stockAdjustment.findMany({ where: scoped, orderBy: { createdAt: "desc" } })).map(S.toAdjustment);
          break;
        case "activity": {
          const sites = scoped.warehouseId ? [scoped.warehouseId] : (await db.warehouse.findMany({ select: { id: true } })).map((w) => w.id);
          const lists = await Promise.all(sites.map((w) => db.activityEvent.findMany({ where: { warehouseId: w }, orderBy: { timestamp: "desc" }, take: ACTIVITY_LIMIT })));
          out.activity = lists.flat().sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).map(S.toActivity);
          break;
        }
        case "notifications":
          out.notifications = (await db.notification.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] }, orderBy: { timestamp: "desc" }, take: 100 })).map(S.toNotification);
          break;
        case "metrics": {
          const rows = await db.dailyMetric.findMany({ where: scoped, orderBy: { date: "asc" } });
          const map: Record<string, ReturnType<typeof S.toMetric>[]> = {};
          rows.forEach((m) => (map[m.warehouseId] ??= []).push(S.toMetric(m)));
          out.metrics = map;
          break;
        }
        case "settings": {
          const rows = await db.setting.findMany();
          out.settings = Object.fromEntries(rows.map((r) => [r.key, r.value]));
          break;
        }
        case "reportSchedules":
          out.reportSchedules = await db.reportSchedule.findMany({ orderBy: { createdAt: "asc" } });
          break;
        case "users":
          out.users = can(user.role, "users.manage") ? (await db.user.findMany({ orderBy: { name: "asc" } })).map(S.toUser) : [];
          break;
      }
    })
  );
  return out;
}
