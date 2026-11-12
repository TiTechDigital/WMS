import type {
  ActivityEvent,
  AppNotification,
  DailyMetric,
  Employee,
  InboundShipment,
  InventoryRecord,
  Order,
  StockAdjustment,
  StockTransfer,
} from "@/types";
import { currentTime, WAREHOUSES, type WarehouseId } from "@/lib/constants";
import { createRng } from "@/lib/random";
import { toISODate } from "@/lib/format";

const MIN = 60000;

export function generateActivity(input: {
  employees: Employee[];
  inbound: InboundShipment[];
  orders: Order[];
  transfers: StockTransfer[];
  adjustments: StockAdjustment[];
  inventory: InventoryRecord[];
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  let seq = 0;
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(8800 + wi);
    const staff = input.employees.filter((e) => e.warehouseId === wh.id);
    const by = (roles: string[]) => {
      const pool = staff.filter((e) => roles.includes(e.role));
      return pool.length ? rng.pick(pool) : staff[0];
    };
    const push = (e: Omit<ActivityEvent, "id" | "warehouseId">) => events.push({ ...e, id: `evt_${++seq}`, warehouseId: wh.id });
    const recentTs = (maxMin: number) => new Date(currentTime().getTime() - rng.int(1, maxMin) * MIN).toISOString();

    input.orders
      .filter((o) => o.warehouseId === wh.id)
      .slice(0, wi === 0 ? 70 : 24)
      .forEach((o) => {
        const units = o.lines.reduce((s, l) => s + l.quantity, 0);
        if (o.status === "shipped" || o.status === "delivered") {
          const e = by(["Packer", "Shift Supervisor"]);
          push({ timestamp: o.shippedAt ?? o.createdAt, actor: e.name, actorRole: e.role, module: "Outbound", action: "Shipment dispatched", entity: o.id, details: `${o.cartons} cartons · ${o.carrier} ${o.service}`, severity: "success", source: "RF Scanner" });
        } else if (o.status === "packing" || o.status === "ready_to_ship") {
          const e = by(["Picker"]);
          push({ timestamp: recentTs(600), actor: e.name, actorRole: e.role, module: "Picking", action: "Pick completed", entity: o.id, details: `${units} unit${units === 1 ? "" : "s"} across ${o.lines.length} line${o.lines.length === 1 ? "" : "s"}`, severity: "info", source: "RF Scanner" });
        } else if (o.status === "new") {
          push({ timestamp: o.createdAt, actor: "Order Gateway", actorRole: "Integration", module: "Outbound", action: "Order received", entity: o.id, details: `${o.customerName} via ${o.channel} · ${o.lines.length} lines`, severity: "info", source: "API" });
        } else if (o.status === "on_hold") {
          push({ timestamp: o.createdAt, actor: "Credit Check", actorRole: "System", module: "Outbound", action: "Order placed on hold", entity: o.id, details: `${o.customerName} — awaiting credit release`, severity: "warning", source: "System" });
        }
      });

    input.inbound
      .filter((s) => s.warehouseId === wh.id && s.status !== "expected")
      .forEach((s) => {
        const e = by(["Receiver"]);
        if (s.arrivedAt) push({ timestamp: s.arrivedAt, actor: "Yard Gate", actorRole: "System", module: "Inbound", action: "Trailer checked in", entity: s.id, details: `${s.carrier} at ${s.dock ?? "yard"} · ${s.pallets} pallets`, severity: "info", source: "System" });
        const short = s.lines.some((l) => l.received > 0 && l.received < l.expected);
        if (s.status === "completed")
          push({ timestamp: s.completedAt ?? s.arrivedAt!, actor: e.name, actorRole: e.role, module: "Inbound", action: short ? "Receipt closed with discrepancy" : "Receipt completed", entity: s.id, details: `${s.poNumber} · ${s.supplierName}`, severity: short ? "warning" : "success", source: "Web" });
      });

    input.transfers
      .filter((t) => t.warehouseId === wh.id)
      .forEach((t) =>
        push({
          timestamp: t.completedAt ?? t.createdAt,
          actor: t.completedAt ? t.assignedTo ?? t.requestedBy : t.requestedBy,
          actorRole: t.completedAt ? "Forklift Operator" : "Inventory Controller",
          module: "Transfers",
          action: t.status === "completed" ? "Transfer completed" : "Transfer requested",
          entity: t.id,
          details: `${t.lines[0].sku} · ${t.fromLocation} → ${t.toLocation}`,
          severity: t.status === "completed" ? "success" : "info",
          source: t.completedAt ? "RF Scanner" : "Web",
        })
      );

    input.adjustments
      .filter((a) => a.warehouseId === wh.id)
      .forEach((a) =>
        push({
          timestamp: a.createdAt,
          actor: a.requestedBy,
          actorRole: "Inventory Controller",
          module: "Adjustments",
          action: a.status === "pending" ? "Adjustment submitted" : a.status === "approved" ? "Adjustment posted" : "Adjustment rejected",
          entity: a.id,
          details: `${a.sku} ${a.after - a.before > 0 ? "+" : ""}${a.after - a.before} · ${a.reason}`,
          severity: Math.abs(a.valueImpact) > 400 ? "warning" : "info",
          source: "RF Scanner",
        })
      );

    input.inventory
      .filter((r) => r.warehouseId === wh.id && (r.status === "low_stock" || r.status === "out_of_stock"))
      .slice(0, 12)
      .forEach((r) =>
        push({
          timestamp: recentTs(60 * 30),
          actor: "Replenishment Engine",
          actorRole: "System",
          module: "Inventory",
          action: r.status === "out_of_stock" ? "Stock-out detected" : "Low stock threshold crossed",
          entity: r.sku,
          details: `${r.productName} at ${r.locationCode}`,
          severity: r.status === "out_of_stock" ? "critical" : "warning",
          source: "System",
        })
      );

    const sys: [string, string, string, ActivityEvent["module"], ActivityEvent["severity"]][] = [
      ["User signed in", "Web session from 10.20.4.18", "Users", "Users", "info"],
      ["Role updated", "Granted 'Approver' to Inventory Controller", "Users", "Users", "warning"],
      ["Wave released", "Wave W-1106-03 · 42 orders", "Outbound", "Picking", "info"],
      ["Cycle count scheduled", "Zone A aisles 01–02 · 64 locations", "Inventory", "Inventory", "info"],
      ["Location blocked", "Rack upright damage reported", "Locations", "Locations", "warning"],
      ["EDI 940 batch imported", "18 orders · 0 errors", "Integration", "System", "success"],
      ["Carrier manifest closed", "UPS pickup 16:30", "Outbound", "Outbound", "success"],
      ["Nightly backup completed", "Snapshot 2.3 GB", "System", "System", "success"],
    ];
    sys.forEach(([action, details, entity, module, severity]) => {
      const e = by(["Shift Supervisor", "Warehouse Manager", "Inventory Controller"]);
      const isSystem = module === "System";
      push({ timestamp: recentTs(60 * 40), actor: isSystem ? "System" : e.name, actorRole: isSystem ? "System" : e.role, module, action, entity, details, severity, source: isSystem ? "System" : "Web" });
    });
  });
  return events.filter((e) => e.timestamp <= currentTime().toISOString()).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Daily operational metrics for the past `days` days, per warehouse. */
export function generateMetrics(days = 180): Record<WarehouseId, DailyMetric[]> {
  const out = {} as Record<WarehouseId, DailyMetric[]>;
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(1200 + wi);
    const scale = [1, 0.48, 0.36][wi];
    let soh = Math.round(118000 * scale);
    const list: DailyMetric[] = [];
    for (let d = days - 1; d >= 0; d--) {
      const date = new Date(Date.UTC(currentTime().getUTCFullYear(), currentTime().getUTCMonth(), currentTime().getUTCDate() - d));
      const dow = date.getUTCDay();
      const weekend = dow === 0 || dow === 6;
      const season = 1 + 0.18 * Math.sin(((days - d) / days) * Math.PI * 1.4) + (days - d) / days / 6;
      const base = (weekend ? 0.45 : 1) * season * scale;
      const inbound = Math.round(base * rng.int(5200, 8600));
      const outbound = Math.round(base * rng.int(5400, 8300));
      const adjustments = Math.round(rng.int(-90, 40) * scale);
      soh = Math.max(40000 * scale, soh + inbound - outbound + adjustments);
      const ordersReceived = Math.round(base * rng.int(310, 470));
      list.push({
        date: toISODate(date),
        inbound,
        outbound,
        adjustments,
        stockOnHand: Math.round(soh),
        ordersReceived,
        ordersShipped: Math.round(ordersReceived * rng.float(0.92, 1.05)),
        onTimeRate: rng.float(weekend ? 93 : 94.5, 99.3, 1),
        pickRate: rng.int(104, 142),
        avgPickMinutes: rng.float(2.6, 4.4, 1),
        accuracy: rng.float(99.1, 99.92, 2),
        utilization: Number(Math.min(96, 68 + (soh / (scale * 1800)) * 0.9 + rng.float(-1.5, 1.5)).toFixed(1)),
      });
    }
    out[wh.id] = list;
  });
  return out;
}

export function generateNotifications(): AppNotification[] {
  const t = (min: number) => new Date(currentTime().getTime() - min * MIN).toISOString();
  return [
    { id: "ntf_1", title: "Stock-out: Li-Ion Battery 5.0Ah", body: "Pick face ATL-A-02-04-B-01 reached zero. 6 open order lines affected.", timestamp: t(4), kind: "alert", read: false, href: "/inventory?status=out_of_stock" },
    { id: "ntf_2", title: "Trailer arrived at DOCK-03", body: "Packwell Packaging Co. · 14 pallets ready for receiving.", timestamp: t(18), kind: "inbound", read: false, href: "/inbound" },
    { id: "ntf_3", title: "Urgent orders at risk", body: "3 urgent orders have not started picking and ship within 2 hours.", timestamp: t(26), kind: "outbound", read: false, href: "/outbound?priority=urgent" },
    { id: "ntf_4", title: "5 adjustments awaiting approval", body: "Net value impact of −$1,284.40 pending your review.", timestamp: t(52), kind: "task", read: false, href: "/adjustments" },
    { id: "ntf_5", title: "Cold storage temperature normal", body: "Zone D sensor back within 2–6 °C after door left open.", timestamp: t(95), kind: "system", read: true, href: "/locations" },
    { id: "ntf_6", title: "Wave W-1106-02 released", body: "38 orders · 214 lines sent to Zone A pickers.", timestamp: t(140), kind: "outbound", read: true, href: "/picking" },
    { id: "ntf_7", title: "Receipt discrepancy", body: "ASN short-shipped by 24 units vs PO. Supplier notified.", timestamp: t(220), kind: "inbound", read: true, href: "/inbound" },
    { id: "ntf_8", title: "Scheduled maintenance tonight", body: "WMS read-only window 02:00–02:30 UTC for database upgrade.", timestamp: t(380), kind: "system", read: true, href: "/settings" },
  ];
}
