/**
 * Seeds a fresh database with a realistic demo dataset (3 sites, ~100 SKUs, orders,
 * inbound shipments, …) plus sign-in accounts.
 *
 *   npm run db:seed
 *
 * Accounts (passwords from env, see .env.example):
 *   admin            → SEED_ADMIN_PASSWORD   (role: admin)
 *   <employee badge> → SEED_USER_PASSWORD    (e.g. ATL-1040; role from job function)
 *
 * Re-running wipes and recreates all data. Never run against production.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getSeed } from "../src/data";
import { WAREHOUSES } from "../src/lib/constants";
import { roleForJob } from "../src/lib/permissions";

const prisma = new PrismaClient();

const FACTORS: Record<string, number> = { "WH-ATL": 1, "WH-DAL": 0.55, "WH-RNO": 0.42 };
const TIMEZONES: Record<string, string> = { "WH-ATL": "America/New_York", "WH-DAL": "America/Chicago", "WH-RNO": "America/Los_Angeles" };

const d = (iso?: string) => (iso ? new Date(iso) : undefined);
const num = (id: string) => Number(id.replace(/\D/g, "")) || 0;

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to seed with NODE_ENV=production. Set ALLOW_PRODUCTION_SEED=true to override.");
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const userPassword = process.env.SEED_USER_PASSWORD;
  if (!adminPassword || adminPassword.length < 8 || !userPassword || userPassword.length < 8) {
    throw new Error("Set SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD (8+ characters) before seeding.");
  }

  const s = getSeed();
  console.log("Clearing existing data…");
  await prisma.$transaction([
    prisma.activityEvent.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.dailyMetric.deleteMany(),
    prisma.pickLine.deleteMany(),
    prisma.pickTask.deleteMany(),
    prisma.orderLine.deleteMany(),
    prisma.order.deleteMany(),
    prisma.inboundLine.deleteMany(),
    prisma.inboundShipment.deleteMany(),
    prisma.transferLine.deleteMany(),
    prisma.stockTransfer.deleteMany(),
    prisma.stockAdjustment.deleteMany(),
    prisma.inventoryRecord.deleteMany(),
    prisma.location.deleteMany(),
    prisma.zone.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.warehouse.deleteMany(),
    prisma.setting.deleteMany(),
    prisma.reportSchedule.deleteMany(),
    prisma.sequence.deleteMany(),
  ]);

  console.log("Sites, zones and locations…");
  await prisma.warehouse.createMany({
    data: WAREHOUSES.map((w) => ({ id: w.id, name: w.name, city: w.city, timezone: TIMEZONES[w.id] ?? "UTC", stockLevelFactor: FACTORS[w.id] ?? 1 })),
  });
  await prisma.zone.createMany({ data: s.zones.map((z) => ({ id: z.id, warehouseId: z.warehouseId, code: z.code, name: z.name, type: z.type, temperature: z.temperature ?? null })) });
  await prisma.location.createMany({
    data: s.locations.map((l) => ({
      id: l.id, code: l.code, warehouseId: l.warehouseId, zone: l.zone, aisle: l.aisle, rack: l.rack, shelf: l.shelf, bin: l.bin,
      type: l.type, capacity: l.capacity, occupied: l.occupied, status: l.status, lastCountedAt: new Date(l.lastCountedAt),
    })),
  });

  console.log("Suppliers, customers, products…");
  await prisma.supplier.createMany({ data: s.suppliers.map((x) => ({ ...x })) });
  await prisma.customer.createMany({ data: s.customers.map((c) => ({ ...c, address: { ...c.address } })) });
  await prisma.product.createMany({
    data: s.products.map(({ dimensions, createdAt, updatedAt, ...p }) => ({
      ...p, lengthCm: dimensions.length, widthCm: dimensions.width, heightCm: dimensions.height, createdAt: new Date(createdAt), updatedAt: new Date(updatedAt),
    })),
  });

  console.log("Inventory…");
  await prisma.inventoryRecord.createMany({
    data: s.inventory.map((r) => ({
      id: r.id, warehouseId: r.warehouseId, productId: r.productId, locationId: r.locationId, locationCode: r.locationCode, lot: r.lot,
      expiresAt: d(r.expiresAt) ?? null, available: r.available, reserved: r.reserved, total: r.total, status: r.status, updatedAt: new Date(r.updatedAt),
    })),
  });

  console.log("Inbound, orders, picking, transfers, adjustments…");
  await prisma.inboundShipment.createMany({
    data: s.inbound.map(({ lines, ...x }) => ({ ...x, dock: x.dock ?? null, notes: x.notes ?? null, expectedAt: new Date(x.expectedAt), arrivedAt: d(x.arrivedAt) ?? null, completedAt: d(x.completedAt) ?? null })),
  });
  await prisma.inboundLine.createMany({ data: s.inbound.flatMap((x) => x.lines.map((l, i) => ({ ...l, shipmentId: x.id, position: i }))) });

  await prisma.order.createMany({
    data: s.orders.map(({ lines, ...o }) => ({
      ...o, shippingAddress: { ...o.shippingAddress }, notes: o.notes ?? null, trackingNumber: o.trackingNumber ?? null,
      createdAt: new Date(o.createdAt), requestedShipAt: new Date(o.requestedShipAt), shippedAt: d(o.shippedAt) ?? null,
    })),
  });
  await prisma.orderLine.createMany({ data: s.orders.flatMap((o) => o.lines.map((l, i) => ({ ...l, orderId: o.id, position: i }))) });

  await prisma.pickTask.createMany({
    data: s.pickTasks.map(({ lines, ...t }) => ({
      ...t, assigneeId: t.assigneeId ?? null, assigneeName: t.assigneeName ?? null, cart: t.cart ?? null,
      createdAt: new Date(t.createdAt), startedAt: d(t.startedAt) ?? null, dueAt: new Date(t.dueAt),
    })),
  });
  await prisma.pickLine.createMany({ data: s.pickTasks.flatMap((t) => t.lines.map((l, i) => ({ ...l, taskId: t.id, position: i }))) });

  await prisma.stockTransfer.createMany({
    data: s.transfers.map(({ lines, ...t }) => ({ ...t, assignedTo: t.assignedTo ?? null, createdAt: new Date(t.createdAt), completedAt: d(t.completedAt) ?? null })),
  });
  await prisma.transferLine.createMany({ data: s.transfers.flatMap((t) => t.lines.map((l, i) => ({ ...l, transferId: t.id, position: i }))) });

  await prisma.stockAdjustment.createMany({
    data: s.adjustments.map((a) => ({ ...a, note: a.note ?? null, approvedBy: a.approvedBy ?? null, createdAt: new Date(a.createdAt) })),
  });

  console.log("People and accounts…");
  await prisma.employee.createMany({ data: s.employees.map((e) => ({ ...e, device: e.device ?? null, hiredAt: new Date(e.hiredAt) })) });
  const [adminHash, userHash] = await Promise.all([bcrypt.hash(adminPassword, 12), bcrypt.hash(userPassword, 12)]);
  await prisma.user.create({
    data: { login: "admin", email: "alex.morgan@northstar-logistics.com", name: "Alex Morgan", passwordHash: adminHash, role: "admin", warehouseId: "WH-ATL", profile: { phone: "+1 (404) 555-0182", language: "English (US)", title: "Operations Manager" } },
  });
  await prisma.user.createMany({
    data: s.employees.map((e) => ({
      login: e.badge, email: e.email, name: e.name, passwordHash: userHash, role: roleForJob(e.role), warehouseId: e.warehouseId, employeeId: e.id, active: e.status !== "on_leave",
    })),
    skipDuplicates: true,
  });

  console.log("Activity, notifications, metrics, settings…");
  await prisma.activityEvent.createMany({ data: s.activity.map(({ id, ...e }) => ({ ...e, timestamp: new Date(e.timestamp) })) });
  await prisma.notification.createMany({ data: s.notifications.map(({ id, ...n }) => ({ ...n, timestamp: new Date(n.timestamp) })) });
  await prisma.dailyMetric.createMany({ data: Object.entries(s.metrics).flatMap(([warehouseId, list]) => list.map((m) => ({ ...m, warehouseId }))) });
  await prisma.setting.createMany({
    data: [
      { key: "organization", value: { company: "Northstar Logistics", timezone: "America/New_York", units: "metric", dateFormat: "dd MMM yyyy", currency: "USD", allocation: "FEFO", putaway: "Closest empty", autoApproveLimit: "250", cycleCountDays: "90" } },
      { key: "integrations", value: { erp: true, shopify: true, edi: true, ups: true, fedex: false, sso: false } },
      { key: "notificationPrefs", value: { lowStock: { app: true, email: true }, inbound: { app: true, email: true }, urgent: { app: true, email: true }, adjust: { app: true, email: false }, digest: { app: true, email: true } } },
    ],
  });
  await prisma.reportSchedule.createMany({
    data: [
      { reportId: "reorder", frequency: "Daily", time: "06:00", recipients: "purchasing@northstar-logistics.com", enabled: true },
      { reportId: "kpi", frequency: "Weekly · Mon", time: "07:30", recipients: "ops-leadership@northstar-logistics.com", enabled: true },
      { reportId: "adjustments", frequency: "Monthly · 1st", time: "08:00", recipients: "finance@northstar-logistics.com", enabled: false },
    ],
  });
  const maxOf = (ids: string[]) => Math.max(0, ...ids.map(num));
  await prisma.sequence.createMany({
    data: [
      { name: "SO", value: maxOf(s.orders.map((o) => o.id)) },
      { name: "ASN", value: maxOf(s.inbound.map((x) => x.id)) },
      { name: "PK", value: maxOf(s.pickTasks.map((t) => t.id)) },
      { name: "TR", value: maxOf(s.transfers.map((t) => t.id)) },
      { name: "ADJ", value: maxOf(s.adjustments.map((a) => a.id)) },
      { name: "SUP", value: maxOf(s.suppliers.map((x) => x.code)) },
      { name: "CUS", value: maxOf(s.customers.map((x) => x.code)) },
      { name: "BADGE", value: maxOf(s.employees.map((e) => e.badge)) },
    ],
  });

  const counts = await Promise.all([prisma.product.count(), prisma.location.count(), prisma.order.count(), prisma.user.count()]);
  console.log(`Done: ${counts[0]} products, ${counts[1]} locations, ${counts[2]} orders, ${counts[3]} users.`);
  console.log(`Sign in as "admin" with SEED_ADMIN_PASSWORD, or with an employee badge (e.g. ATL-1040) and SEED_USER_PASSWORD.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
