import "server-only";
import { db } from "../db";
import { HttpError } from "../http";
import type { CurrentUser } from "../auth/session";
import { assertSiteAccess } from "../auth/session";
import { can } from "@/lib/permissions";
import { INBOUND_STAGES, ORDER_STAGES, type InboundStatus, type OrderStatus, type Priority } from "@/types";
import { conflict, logActivity, nextNumber, notFound, type Tx } from "./common";
import { applyStockDelta } from "./stock";

const HOUR = 3600_000;
const label = (s: string) => s.replace(/_/g, " ");
const trackingNumber = () => `1Z${Math.floor(100000 + Math.random() * 899999)}A${Math.floor(10000000 + Math.random() * 89999999)}`;

/* ───────────────────────────── Inbound ───────────────────────────── */

export async function advanceInbound(user: CurrentUser, id: string) {
  return db.$transaction(async (tx) => {
    const s = (await tx.inboundShipment.findUnique({ where: { id }, include: { lines: true } })) ?? notFound("Shipment");
    assertSiteAccess(user, s.warehouseId);
    const i = INBOUND_STAGES.indexOf(s.status as InboundStatus);
    if (i < 0 || i >= INBOUND_STAGES.length - 1) conflict(`${id} is already ${label(s.status)}.`);
    const next = INBOUND_STAGES[i + 1];
    const now = new Date();

    const data: Record<string, unknown> = { status: next };
    if (next === "arrived") {
      data.arrivedAt = now;
      data.dock = s.dock ?? `DOCK-0${1 + (id.charCodeAt(id.length - 1) % 6)}`;
    }
    if (next === "quality_check") {
      for (const l of s.lines) if (!l.received) await tx.inboundLine.update({ where: { id: l.id }, data: { received: l.expected } });
    }
    if (next === "completed") {
      data.completedAt = now;
      const lines = await tx.inboundLine.findMany({ where: { shipmentId: id } });
      for (const l of lines) {
        const qty = Math.max(0, l.received - l.damaged);
        if (!qty) continue;
        const target = await tx.inventoryRecord.findFirst({ where: { warehouseId: s.warehouseId, productId: l.productId }, orderBy: { total: "desc" } });
        await applyStockDelta(tx, s.warehouseId, l.productId, qty, target?.locationCode);
      }
    }
    await tx.inboundShipment.update({ where: { id }, data });
    await logActivity(tx, user, s.warehouseId, {
      module: "Inbound",
      action: `ASN moved to ${label(next)}`,
      entity: id,
      details: `${s.poNumber} · ${s.supplierName}`,
      severity: next === "completed" ? "success" : "info",
    });
    return { status: next };
  });
}

export async function updateInboundLine(user: CurrentUser, id: string, sku: string, received: number, damaged: number) {
  return db.$transaction(async (tx) => {
    const s = (await tx.inboundShipment.findUnique({ where: { id }, include: { lines: true } })) ?? notFound("Shipment");
    assertSiteAccess(user, s.warehouseId);
    if (s.status !== "arrived" && s.status !== "receiving") conflict("Quantities can only be edited while the shipment is being received.");
    const line = s.lines.find((l) => l.sku === sku) ?? notFound("Line");
    if (damaged > received) throw new HttpError(400, "Damaged quantity can't exceed received quantity.");
    await tx.inboundLine.update({ where: { id: line.id }, data: { received, damaged } });
    if (s.status === "arrived") await tx.inboundShipment.update({ where: { id }, data: { status: "receiving" } });
    return { ok: true };
  });
}

export async function createInbound(
  user: CurrentUser,
  input: { warehouseId: string; supplierId: string; poNumber: string; carrier: string; expectedAt: string; priority: Priority; lines: { productId: string; expected: number }[] }
) {
  assertSiteAccess(user, input.warehouseId);
  return db.$transaction(async (tx) => {
    const supplier = (await tx.supplier.findUnique({ where: { id: input.supplierId } })) ?? notFound("Supplier");
    const products = await tx.product.findMany({ where: { id: { in: input.lines.map((l) => l.productId) } } });
    if (products.length !== new Set(input.lines.map((l) => l.productId)).size) throw new HttpError(400, "One or more products don't exist.");
    const id = await nextNumber(tx, "ASN");
    const units = input.lines.reduce((a, l) => a + l.expected, 0);
    await tx.inboundShipment.create({
      data: {
        id, warehouseId: input.warehouseId, poNumber: input.poNumber, supplierId: supplier.id, supplierName: supplier.name, carrier: input.carrier,
        trackingNumber: `PRO${Math.floor(10000000 + Math.random() * 89999999)}`, expectedAt: new Date(input.expectedAt), status: "expected",
        priority: input.priority, pallets: Math.max(1, Math.round(units / 180)),
        lines: {
          create: input.lines.map((l, i) => {
            const p = products.find((x) => x.id === l.productId)!;
            return { position: i, productId: p.id, sku: p.sku, productName: p.name, expected: l.expected };
          }),
        },
      },
    });
    await logActivity(tx, user, input.warehouseId, { module: "Inbound", action: "ASN created", entity: id, details: `${input.poNumber} · ${supplier.name}` });
    return { id };
  });
}

/* ───────────────────────────── Orders ───────────────────────────── */

async function setOrderStatusTx(tx: Tx, user: CurrentUser, id: string, status: OrderStatus) {
  const o = (await tx.order.findUnique({ where: { id }, include: { lines: true } })) ?? notFound("Order");
  assertSiteAccess(user, o.warehouseId);
  const picked = ["packing", "ready_to_ship", "shipped", "delivered"].includes(status);
  const packed = ["ready_to_ship", "shipped", "delivered"].includes(status);
  for (const l of o.lines) {
    await tx.orderLine.update({ where: { id: l.id }, data: { picked: picked ? l.quantity : l.picked, packed: packed ? l.quantity : l.packed } });
  }
  await tx.order.update({
    where: { id },
    data: {
      status,
      shippedAt: status === "shipped" ? new Date() : o.shippedAt,
      trackingNumber: packed && !o.trackingNumber ? trackingNumber() : o.trackingNumber,
    },
  });
  if (status === "picking") {
    await tx.pickTask.updateMany({ where: { orderId: id, status: "queued" }, data: { status: "in_progress", startedAt: new Date() } });
  }
  if (["packing", "ready_to_ship", "shipped"].includes(status)) {
    const tasks = await tx.pickTask.findMany({ where: { orderId: id }, include: { lines: true } });
    for (const t of tasks) {
      await tx.pickTask.update({ where: { id: t.id }, data: { status: "completed" } });
      for (const l of t.lines) await tx.pickLine.update({ where: { id: l.id }, data: { picked: l.quantity } });
    }
  }
  await logActivity(tx, user, o.warehouseId, {
    module: "Outbound",
    action: `Order ${label(status)}`,
    entity: id,
    details: `Status changed to ${label(status)}`,
    severity: status === "shipped" ? "success" : status === "cancelled" ? "warning" : "info",
  });
  return o;
}

async function ensurePickTask(tx: Tx, orderId: string) {
  const existing = await tx.pickTask.findFirst({ where: { orderId } });
  if (existing) return;
  const o = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
  const products = await tx.product.findMany({ where: { id: { in: o.lines.map((l) => l.productId) } }, select: { id: true, uom: true } });
  const uom = new Map(products.map((p) => [p.id, p.uom]));
  const lines = [...o.lines].sort((a, b) => a.locationCode.localeCompare(b.locationCode));
  const zone = lines[0]?.locationCode.split("-")[1] ?? "A";
  await tx.pickTask.create({
    data: {
      id: await nextNumber(tx, "PK"),
      warehouseId: o.warehouseId, orderId: o.id, customerName: o.customerName, type: o.lines.length > 4 ? "batch" : "single",
      zone: zone === "LANE" ? "C" : zone, priority: o.priority, status: "queued", dueAt: o.requestedShipAt,
      lines: { create: lines.map((l, i) => ({ position: i, sku: l.sku, productName: l.productName, locationCode: l.locationCode, quantity: l.quantity, uom: uom.get(l.productId) ?? "EA" })) },
    },
  });
}

async function advanceOrderTx(tx: Tx, user: CurrentUser, id: string): Promise<OrderStatus> {
  const o = (await tx.order.findUnique({ where: { id } })) ?? notFound("Order");
  if (o.status === "on_hold") {
    await setOrderStatusTx(tx, user, id, "new");
    return "new";
  }
  const i = (ORDER_STAGES as readonly string[]).indexOf(o.status);
  if (i < 0 || i >= ORDER_STAGES.length - 1) conflict(`${id} can't be advanced from ${label(o.status)}.`);
  const next = ORDER_STAGES[i + 1];
  if (next === "allocated") await ensurePickTask(tx, id);
  await setOrderStatusTx(tx, user, id, next);
  return next;
}

export async function advanceOrder(user: CurrentUser, id: string) {
  return db.$transaction(async (tx) => ({ status: await advanceOrderTx(tx, user, id) }));
}

export async function advanceOrders(user: CurrentUser, ids: string[]) {
  return db.$transaction(async (tx) => {
    const results: { id: string; status?: string; error?: string }[] = [];
    for (const id of ids) {
      try {
        results.push({ id, status: await advanceOrderTx(tx, user, id) });
      } catch (e) {
        results.push({ id, error: e instanceof Error ? e.message : "Failed" });
      }
    }
    return { results };
  });
}

export async function setOrderStatus(user: CurrentUser, ids: string[], status: OrderStatus) {
  return db.$transaction(async (tx) => {
    for (const id of ids) await setOrderStatusTx(tx, user, id, status);
    return { count: ids.length };
  });
}

export async function setOrderPriority(user: CurrentUser, id: string, priority: Priority) {
  return db.$transaction(async (tx) => {
    const o = (await tx.order.findUnique({ where: { id } })) ?? notFound("Order");
    assertSiteAccess(user, o.warehouseId);
    await tx.order.update({ where: { id }, data: { priority } });
    await tx.pickTask.updateMany({ where: { orderId: id }, data: { priority } });
    await logActivity(tx, user, o.warehouseId, { module: "Outbound", action: "Priority changed", entity: id, details: `Priority set to ${priority}` });
    return { ok: true };
  });
}

export async function releaseWave(user: CurrentUser, warehouseId: string) {
  assertSiteAccess(user, warehouseId);
  return db.$transaction(
    async (tx) => {
      const orders = await tx.order.findMany({ where: { warehouseId, status: "new" }, select: { id: true } });
      for (const o of orders) await advanceOrderTx(tx, user, o.id);
      if (orders.length) {
        const d = new Date();
        const wave = `W-${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}-${String(orders.length).padStart(2, "0")}`;
        await logActivity(tx, user, warehouseId, { module: "Picking", action: "Wave released", entity: wave, details: `${orders.length} orders allocated to pick tasks` });
      }
      return { count: orders.length };
    },
    { timeout: 30_000 }
  );
}

export async function createOrder(
  user: CurrentUser,
  input: { warehouseId: string; customerId: string; priority: Priority; carrier: string; service: string; notes?: string; lines: { productId: string; quantity: number }[] }
) {
  assertSiteAccess(user, input.warehouseId);
  return db.$transaction(async (tx) => {
    const c = (await tx.customer.findUnique({ where: { id: input.customerId } })) ?? notFound("Customer");
    if (c.status !== "active") conflict(`${c.name} is ${label(c.status)} and can't place orders.`);
    const products = await tx.product.findMany({ where: { id: { in: input.lines.map((l) => l.productId) } } });
    const lines = [];
    for (const l of input.lines) {
      const p = products.find((x) => x.id === l.productId) ?? notFound("Product");
      const stock = await tx.inventoryRecord.findMany({ where: { warehouseId: input.warehouseId, productId: p.id, available: { gt: 0 } }, orderBy: { available: "desc" } });
      const available = stock.reduce((a, r) => a + r.available, 0);
      if (l.quantity > available) throw new HttpError(409, `Only ${available} units of ${p.sku} available.`);
      lines.push({ p, quantity: l.quantity, locationCode: stock[0]?.locationCode ?? "" });
    }
    const id = await nextNumber(tx, "SO");
    const weight = lines.reduce((a, l) => a + l.p.weightKg * l.quantity, 0);
    const hours = input.priority === "urgent" ? 8 : input.priority === "high" ? 20 : 44;
    await tx.order.create({
      data: {
        id, warehouseId: input.warehouseId, customerId: c.id, customerName: c.name, channel: "Manual",
        requestedShipAt: new Date(Date.now() + hours * HOUR), priority: input.priority, status: "new",
        shippingAddress: c.address as object, carrier: input.carrier, service: input.service,
        weightKg: Number(weight.toFixed(1)), cartons: Math.max(1, Math.ceil(weight / 18)), notes: input.notes || null,
        lines: { create: lines.map((l, i) => ({ position: i, productId: l.p.id, sku: l.p.sku, productName: l.p.name, locationCode: l.locationCode, quantity: l.quantity, unitPrice: l.p.unitPrice })) },
      },
    });
    await logActivity(tx, user, input.warehouseId, { module: "Outbound", action: "Order created", entity: id, details: `${c.name} · ${lines.length} lines` });
    return { id };
  });
}

/* ───────────────────────────── Picking ───────────────────────────── */

export async function assignTask(user: CurrentUser, taskId: string, employeeId: string) {
  return db.$transaction(async (tx) => {
    const t = (await tx.pickTask.findUnique({ where: { id: taskId } })) ?? notFound("Task");
    assertSiteAccess(user, t.warehouseId);
    const e = (await tx.employee.findUnique({ where: { id: employeeId } })) ?? notFound("Operator");
    await tx.pickTask.update({ where: { id: taskId }, data: { assigneeId: e.id, assigneeName: e.name } });
    await logActivity(tx, user, t.warehouseId, { module: "Picking", action: "Task assigned", entity: taskId, details: `Assigned to ${e.name}` });
    return { ok: true };
  });
}

export async function setTaskStatus(user: CurrentUser, taskId: string, status: "in_progress" | "paused") {
  return db.$transaction(async (tx) => {
    const t = (await tx.pickTask.findUnique({ where: { id: taskId } })) ?? notFound("Task");
    assertSiteAccess(user, t.warehouseId);
    if (t.status === "completed") conflict("This task is already completed.");
    await tx.pickTask.update({
      where: { id: taskId },
      data: { status, startedAt: t.startedAt ?? (status === "in_progress" ? new Date() : null), cart: t.cart ?? (status === "in_progress" ? `CART-${10 + (taskId.charCodeAt(4) % 38)}` : null) },
    });
    if (status === "in_progress") await tx.order.updateMany({ where: { id: t.orderId, status: { in: ["new", "allocated"] } }, data: { status: "picking" } });
    await logActivity(tx, user, t.warehouseId, { module: "Picking", action: status === "in_progress" ? "Task started" : "Task paused", entity: taskId, details: t.orderId, source: "RF Scanner" });
    return { ok: true };
  });
}

/** Record the picked quantity for one line; completing the last line moves the order to packing. */
export async function confirmPick(user: CurrentUser, taskId: string, lineIndex: number, picked: number) {
  return db.$transaction(async (tx) => {
    const t = (await tx.pickTask.findUnique({ where: { id: taskId }, include: { lines: { orderBy: { position: "asc" } } } })) ?? notFound("Task");
    assertSiteAccess(user, t.warehouseId);
    if (t.status === "completed") conflict("This task is already completed.");
    const line = t.lines[lineIndex] ?? notFound("Line");
    const qty = Math.max(0, Math.min(line.quantity, picked));
    await tx.pickLine.update({ where: { id: line.id }, data: { picked: qty } });
    const completed = t.lines.every((l) => (l.id === line.id ? qty : l.picked) >= l.quantity);
    await tx.pickTask.update({ where: { id: taskId }, data: { status: completed ? "completed" : "in_progress", startedAt: t.startedAt ?? new Date() } });
    const o = await tx.order.findUnique({ where: { id: t.orderId } });
    if (o) {
      await tx.orderLine.updateMany({ where: { orderId: o.id, sku: line.sku, locationCode: line.locationCode }, data: { picked: qty } });
      const nextStatus = completed ? "packing" : o.status === "allocated" || o.status === "new" ? "picking" : o.status;
      if (nextStatus !== o.status) await tx.order.update({ where: { id: o.id }, data: { status: nextStatus } });
    }
    await logActivity(tx, user, t.warehouseId, {
      module: "Picking",
      action: completed ? "Pick task completed" : "Line picked",
      entity: taskId,
      details: completed ? `${t.orderId} released to packing` : `${line.sku} × ${qty} from ${line.locationCode}`,
      severity: completed ? "success" : "info",
      source: "RF Scanner",
    });
    return { completed };
  });
}

/* ───────────────────────────── Transfers ───────────────────────────── */

export async function createTransfer(
  user: CurrentUser,
  input: { warehouseId: string; type: "internal" | "inter-warehouse" | "replenishment"; fromLocation: string; toLocation: string; productId: string; quantity: number; reason: string }
) {
  assertSiteAccess(user, input.warehouseId);
  return db.$transaction(async (tx) => {
    const p = (await tx.product.findUnique({ where: { id: input.productId } })) ?? notFound("Product");
    const src = await tx.inventoryRecord.findFirst({ where: { warehouseId: input.warehouseId, productId: p.id, locationCode: input.fromLocation } });
    if (!src) throw new HttpError(400, `${p.sku} isn't stocked at ${input.fromLocation}.`);
    if (input.quantity > src.available) throw new HttpError(409, `Only ${src.available} units available at ${input.fromLocation}.`);
    if (input.type !== "inter-warehouse") {
      const dest = await tx.location.findFirst({ where: { warehouseId: input.warehouseId, code: input.toLocation } });
      if (!dest) throw new HttpError(400, `Location ${input.toLocation} doesn't exist.`);
      if (dest.status !== "active") conflict(`${input.toLocation} is ${dest.status} and can't receive stock.`);
    }
    const id = await nextNumber(tx, "TR");
    await tx.stockTransfer.create({
      data: {
        id, warehouseId: input.warehouseId, type: input.type, fromLocation: input.fromLocation, toLocation: input.toLocation, status: "requested",
        requestedBy: user.name, reason: input.reason, lines: { create: [{ position: 0, productId: p.id, sku: p.sku, productName: p.name, quantity: input.quantity }] },
      },
    });
    await logActivity(tx, user, input.warehouseId, { module: "Transfers", action: "Transfer requested", entity: id, details: `${p.sku} · ${input.fromLocation} → ${input.toLocation}` });
    return { id };
  });
}

const TRANSFER_FLOW: Record<string, string[]> = {
  draft: ["requested", "cancelled"],
  requested: ["in_transit", "cancelled"],
  in_transit: ["completed", "cancelled"],
};

export async function setTransferStatus(user: CurrentUser, id: string, status: "requested" | "in_transit" | "completed" | "cancelled") {
  return db.$transaction(async (tx) => {
    const t = (await tx.stockTransfer.findUnique({ where: { id }, include: { lines: true } })) ?? notFound("Transfer");
    assertSiteAccess(user, t.warehouseId);
    if (!TRANSFER_FLOW[t.status]?.includes(status)) conflict(`A ${label(t.status)} transfer can't move to ${label(status)}.`);
    await tx.stockTransfer.update({
      where: { id },
      data: { status, completedAt: status === "completed" ? new Date() : t.completedAt, assignedTo: t.assignedTo ?? (status === "in_transit" ? user.name : null) },
    });
    if (status === "completed") {
      for (const l of t.lines) {
        await applyStockDelta(tx, t.warehouseId, l.productId, -l.quantity, t.fromLocation);
        if (t.type !== "inter-warehouse") await applyStockDelta(tx, t.warehouseId, l.productId, l.quantity, t.toLocation);
      }
    }
    await logActivity(tx, user, t.warehouseId, {
      module: "Transfers",
      action: `Transfer ${label(status)}`,
      entity: id,
      details: `${t.fromLocation} → ${t.toLocation}`,
      severity: status === "completed" ? "success" : status === "cancelled" ? "warning" : "info",
    });
    return { ok: true };
  });
}

/* ───────────────────────────── Adjustments ───────────────────────────── */

export async function createAdjustment(
  user: CurrentUser,
  input: { warehouseId: string; productId: string; locationCode: string; counted: number; reason: string; note?: string; postNow?: boolean }
) {
  assertSiteAccess(user, input.warehouseId);
  if (input.postNow && !can(user.role, "adjustments.approve")) throw new HttpError(403, "Only supervisors and above can post adjustments without approval.");
  return db.$transaction(async (tx) => {
    const p = (await tx.product.findUnique({ where: { id: input.productId } })) ?? notFound("Product");
    const rec = await tx.inventoryRecord.findFirst({ where: { warehouseId: input.warehouseId, productId: p.id, locationCode: input.locationCode } });
    if (!rec) throw new HttpError(400, `${p.sku} isn't stocked at ${input.locationCode}.`);
    const delta = input.counted - rec.total;
    if (delta === 0) throw new HttpError(400, "Counted quantity matches the system — no adjustment needed.");
    const id = await nextNumber(tx, "ADJ");
    await tx.stockAdjustment.create({
      data: {
        id, warehouseId: input.warehouseId, productId: p.id, sku: p.sku, productName: p.name, locationCode: input.locationCode,
        before: rec.total, after: input.counted, reason: input.reason, note: input.note || null, requestedBy: user.name,
        approvedBy: input.postNow ? user.name : null, status: input.postNow ? "approved" : "pending", valueImpact: Number((delta * p.unitCost).toFixed(2)),
      },
    });
    if (input.postNow) await applyStockDelta(tx, input.warehouseId, p.id, delta, input.locationCode);
    await logActivity(tx, user, input.warehouseId, {
      module: "Adjustments",
      action: input.postNow ? "Adjustment posted" : "Adjustment submitted",
      entity: id,
      details: `${p.sku} ${delta > 0 ? "+" : ""}${delta} · ${input.reason}`,
      severity: input.postNow ? "success" : "info",
    });
    return { id, status: input.postNow ? "approved" : "pending" };
  });
}

export async function reviewAdjustments(user: CurrentUser, ids: string[], decision: "approved" | "rejected") {
  return db.$transaction(async (tx) => {
    let count = 0;
    for (const id of ids) {
      const a = (await tx.stockAdjustment.findUnique({ where: { id } })) ?? notFound("Adjustment");
      assertSiteAccess(user, a.warehouseId);
      if (a.status !== "pending") continue;
      await tx.stockAdjustment.update({ where: { id }, data: { status: decision, approvedBy: decision === "approved" ? user.name : null } });
      if (decision === "approved") await applyStockDelta(tx, a.warehouseId, a.productId, a.after - a.before, a.locationCode);
      await logActivity(tx, user, a.warehouseId, {
        module: "Adjustments",
        action: decision === "approved" ? "Adjustment posted" : "Adjustment rejected",
        entity: id,
        details: `${a.sku} ${a.after - a.before >= 0 ? "+" : ""}${a.after - a.before}`,
        severity: decision === "approved" ? "success" : "warning",
      });
      count++;
    }
    return { count };
  });
}
