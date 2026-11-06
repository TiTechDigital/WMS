import type {
  Customer,
  Employee,
  InboundShipment,
  InboundStatus,
  InventoryRecord,
  Order,
  OrderStatus,
  PickTask,
  Priority,
  Product,
  SalesChannel,
  StockAdjustment,
  StockTransfer,
  Supplier,
  AdjustmentReason,
  TransferStatus,
} from "@/types";
import { REFERENCE_NOW, WAREHOUSES, type WarehouseId } from "@/lib/constants";
import { createRng } from "@/lib/random";

const HOUR = 3600000;
const DAY = 24 * HOUR;
const at = (offsetMs: number) => new Date(REFERENCE_NOW.getTime() + offsetMs).toISOString();
const roundTo = (ms: number, step: number) => Math.round(ms / step) * step;

const INBOUND_CARRIERS = ["XPO Logistics", "Old Dominion", "Estes Express", "Saia LTL", "J.B. Hunt", "Maersk Line", "R+L Carriers"];
const PARCEL: [string, string[]][] = [
  ["UPS", ["Ground", "2nd Day Air", "Next Day Air"]],
  ["FedEx", ["Ground", "Express Saver", "Priority Overnight"]],
  ["USPS", ["Priority Mail", "Ground Advantage"]],
  ["XPO Logistics", ["LTL Standard"]],
  ["Old Dominion", ["LTL Guaranteed"]],
];

const COUNTS: Record<WarehouseId, { inbound: number; orders: number; transfers: number; adjustments: number }> = {
  "WH-ATL": { inbound: 36, orders: 150, transfers: 26, adjustments: 32 },
  "WH-DAL": { inbound: 16, orders: 60, transfers: 10, adjustments: 12 },
  "WH-RNO": { inbound: 12, orders: 46, transfers: 8, adjustments: 9 },
};

/* ───────────────────────────── Inbound ───────────────────────────── */

export function generateInbound(products: Product[], suppliers: Supplier[], inventory: InventoryRecord[]): InboundShipment[] {
  const out: InboundShipment[] = [];
  let asn = 58210;
  let po = 44120;
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(2200 + wi);
    const stockedIds = new Set(inventory.filter((r) => r.warehouseId === wh.id).map((r) => r.productId));
    const activeSuppliers = suppliers.filter((s) => s.status === "active");
    for (let i = 0; i < COUNTS[wh.id].inbound; i++) {
      const status = rng.weighted<InboundStatus>([
        ["expected", 9],
        ["arrived", 2.5],
        ["receiving", 3],
        ["quality_check", 2],
        ["putaway", 2],
        ["completed", 8],
      ]);
      const supplier = rng.pick(activeSuppliers);
      let pool = products.filter((p) => p.supplierId === supplier.id && stockedIds.has(p.id));
      if (pool.length === 0) pool = products.filter((p) => stockedIds.has(p.id) && supplier.categories.includes(p.category));
      if (pool.length === 0) pool = products.filter((p) => stockedIds.has(p.id));
      const lineCount = Math.min(pool.length, rng.int(1, 6));
      const picked = rng.shuffle(pool).slice(0, lineCount);

      const expectedOffset =
        status === "expected"
          ? roundTo(rng.int(-2, 7 * 24) * HOUR, HOUR)
          : status === "completed"
            ? -rng.int(1, 14) * DAY - rng.int(0, 10) * HOUR
            : -rng.int(1, 20) * HOUR;
      const expectedAt = roundTo(expectedOffset, HOUR / 2);
      const arrived = status !== "expected";
      const arrivedOffset = arrived ? Math.min(-rng.int(15, 90) * 60000, expectedAt + rng.int(-90, 180) * 60000) : undefined;

      const lines = picked.map((p) => {
        const expected = Math.max(p.unitsPerCase, Math.round((p.reorderQty * rng.float(0.4, 1.1)) / 10) * 10);
        let received = 0;
        let damaged = 0;
        if (status === "receiving") received = Math.round(expected * rng.float(0.15, 0.9));
        if (status === "quality_check" || status === "putaway" || status === "completed") {
          const variance = rng.weighted<number>([[0, 10], [-1, 1.4], [1, 0.4]]);
          received = variance === 0 ? expected : variance < 0 ? expected - rng.int(1, Math.max(2, Math.round(expected * 0.08))) : expected + rng.int(1, 12);
          damaged = rng.chance(0.08) ? rng.int(1, Math.max(2, Math.round(expected * 0.03))) : 0;
        }
        return { productId: p.id, sku: p.sku, productName: p.name, expected, received, damaged };
      });

      asn += rng.int(3, 17);
      po += rng.int(2, 9);
      out.push({
        id: `ASN-${asn}`,
        warehouseId: wh.id,
        poNumber: `PO-${po}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        carrier: supplier.country === "United States" ? rng.pick(INBOUND_CARRIERS.slice(0, 5)) : rng.pick(["Maersk Line", "J.B. Hunt", "XPO Logistics"]),
        trackingNumber: `${rng.pick(["PRO", "BOL", "CN"])}${rng.int(10000000, 99999999)}`,
        dock: arrived && status !== "completed" ? `DOCK-${String(rng.int(1, 6)).padStart(2, "0")}` : status === "completed" ? `DOCK-${String(rng.int(1, 6)).padStart(2, "0")}` : undefined,
        expectedAt: at(expectedAt),
        arrivedAt: arrivedOffset !== undefined ? at(arrivedOffset) : undefined,
        completedAt: status === "completed" ? at((arrivedOffset ?? expectedAt) + rng.int(2, 7) * HOUR) : undefined,
        status,
        priority: rng.weighted<Priority>([["normal", 7], ["high", 2], ["urgent", 0.7], ["low", 1.5]]),
        pallets: Math.max(1, Math.round(lines.reduce((s, l) => s + l.expected, 0) / rng.int(80, 260))),
        lines,
        notes: rng.chance(0.15) ? rng.pick(["Temperature log required on arrival.", "Supplier advised 1 pallet short — balance next week.", "Mixed SKU pallets, break down at R-STG.", "Liftgate required."]) : undefined,
      });
    }
  });
  return out.sort((a, b) => a.expectedAt.localeCompare(b.expectedAt));
}

/* ───────────────────────────── Orders ───────────────────────────── */

export function generateOrders(products: Product[], customers: Customer[], inventory: InventoryRecord[]): Order[] {
  const out: Order[] = [];
  let so = 104200;
  const productById = new Map(products.map((p) => [p.id, p]));
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(3300 + wi);
    const stock = inventory.filter((r) => r.warehouseId === wh.id && r.total > 0);
    const pickFaces = new Map<string, InventoryRecord>();
    stock.forEach((r) => {
      if (!pickFaces.has(r.productId) && !r.locationCode.includes("-B-")) pickFaces.set(r.productId, r);
    });
    stock.forEach((r) => {
      if (!pickFaces.has(r.productId)) pickFaces.set(r.productId, r);
    });
    const faces = [...pickFaces.values()];
    const activeCustomers = customers.filter((c) => c.status !== "inactive");

    for (let i = 0; i < COUNTS[wh.id].orders; i++) {
      // Age in hours. Older orders are shipped; newer ones are in flight.
      const ageH = rng.weighted<[number, number]>([[[0, 6], 4], [[6, 24], 4], [[24, 72], 3], [[72, 240], 6]]);
      const age = rng.int(ageH[0], ageH[1]) * HOUR + rng.int(0, 59) * 60000;
      let status: OrderStatus;
      if (age < 3 * HOUR) status = rng.weighted([["new", 5], ["allocated", 3], ["on_hold", 0.4]]);
      else if (age < 12 * HOUR) status = rng.weighted([["allocated", 2], ["picking", 4], ["packing", 2], ["new", 1]]);
      else if (age < 30 * HOUR) status = rng.weighted([["picking", 1.5], ["packing", 2], ["ready_to_ship", 3], ["shipped", 2]]);
      else if (age < 72 * HOUR) status = rng.weighted([["shipped", 6], ["delivered", 2], ["ready_to_ship", 0.6], ["cancelled", 0.3]]);
      else status = rng.weighted([["delivered", 8], ["shipped", 1], ["cancelled", 0.3]]);

      const customer = rng.pick(activeCustomers);
      const channel: SalesChannel =
        customer.type === "E-commerce" ? rng.pick<SalesChannel>(["Shopify", "Marketplace"]) : customer.type === "Distributor" ? "EDI" : rng.pick<SalesChannel>(["B2B Portal", "EDI", "Manual"]);
      const lineCount = customer.type === "E-commerce" ? rng.int(1, 3) : rng.int(2, 7);
      const chosen = rng.shuffle(faces).slice(0, lineCount);
      const [carrier, services] = customer.type === "E-commerce" ? rng.pick(PARCEL.slice(0, 3)) : rng.pick(PARCEL);
      const service = rng.pick(services);

      const lines = chosen.map((r) => {
        const p = productById.get(r.productId)!;
        const quantity = customer.type === "E-commerce" ? rng.int(1, 3) : rng.int(2, 48);
        const picked =
          ["packing", "ready_to_ship", "shipped", "delivered"].includes(status) ? quantity : status === "picking" ? rng.int(0, quantity) : 0;
        const packed = ["ready_to_ship", "shipped", "delivered"].includes(status) ? quantity : status === "packing" ? rng.int(0, picked) : 0;
        return { productId: p.id, sku: p.sku, productName: p.name, locationCode: r.locationCode, quantity, picked, packed, unitPrice: p.unitPrice };
      });
      const weightKg = Number(lines.reduce((s, l) => s + l.quantity * (productById.get(l.productId)?.weightKg ?? 1), 0).toFixed(1));
      const priority: Priority =
        customer.slaTier === "Platinum" ? rng.weighted([["high", 4], ["urgent", 2], ["normal", 3]]) : rng.weighted([["normal", 8], ["high", 2], ["low", 2], ["urgent", 0.6]]);
      so += rng.int(1, 9);
      const created = -age;
      const shipped = ["shipped", "delivered"].includes(status);
      out.push({
        id: `SO-${so}`,
        warehouseId: wh.id,
        customerId: customer.id,
        customerName: customer.name,
        channel,
        createdAt: at(created),
        requestedShipAt: at(roundTo(created + (priority === "urgent" ? 8 : priority === "high" ? 20 : 44) * HOUR, HOUR)),
        shippedAt: shipped ? at(created + rng.int(8, 30) * HOUR) : undefined,
        priority,
        status,
        shippingAddress: customer.address,
        carrier,
        service,
        trackingNumber: shipped || status === "ready_to_ship" ? (carrier === "UPS" ? `1Z${rng.int(100000, 999999)}A${rng.int(10000000, 99999999)}` : `${rng.int(100000000, 999999999)}${rng.int(100, 999)}`) : undefined,
        lines,
        weightKg,
        cartons: Math.max(1, Math.ceil(weightKg / 18)),
        notes: rng.chance(0.08) ? rng.pick(["Deliver to rear loading bay.", "Call ahead 30 min before delivery.", "Pallet must not exceed 1.5m height.", "Include packing list in each carton."]) : undefined,
      });
    }
  });
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* ───────────────────────────── Picking ───────────────────────────── */

export function generatePickTasks(orders: Order[], employees: Employee[], products: Product[]): PickTask[] {
  const rng = createRng(4401);
  const uom = new Map(products.map((p) => [p.id, p.uom]));
  let seq = 77100;
  const tasks: PickTask[] = [];
  orders
    .filter((o) => ["allocated", "picking", "packing"].includes(o.status))
    .forEach((o) => {
      const pickers = employees.filter((e) => e.warehouseId === o.warehouseId && e.role === "Picker" && e.status === "on_shift");
      const status = o.status === "picking" ? (rng.chance(0.1) ? "paused" : "in_progress") : o.status === "packing" ? "completed" : "queued";
      const assignee = status !== "queued" || rng.chance(0.4) ? (pickers.length ? rng.pick(pickers) : undefined) : undefined;
      const zone = o.lines[0]?.locationCode.split("-")[1] ?? "A";
      seq += rng.int(1, 5);
      tasks.push({
        id: `PK-${seq}`,
        warehouseId: o.warehouseId,
        orderId: o.id,
        customerName: o.customerName,
        type: o.lines.length > 4 ? "batch" : rng.chance(0.2) ? "wave" : "single",
        zone: zone === "LANE" ? "C" : zone,
        assigneeId: assignee?.id,
        assigneeName: assignee?.name,
        priority: o.priority,
        status,
        createdAt: o.createdAt,
        startedAt: status !== "queued" ? at(new Date(o.createdAt).getTime() - REFERENCE_NOW.getTime() + rng.int(20, 120) * 60000) : undefined,
        dueAt: o.requestedShipAt,
        cart: status !== "queued" ? `CART-${rng.int(10, 48)}` : undefined,
        lines: [...o.lines]
          .sort((a, b) => a.locationCode.localeCompare(b.locationCode))
          .map((l) => ({ sku: l.sku, productName: l.productName, locationCode: l.locationCode, quantity: l.quantity, picked: l.picked, uom: uom.get(l.productId) ?? "EA" })),
      });
    });
  return tasks;
}

/* ───────────────────────────── Transfers & Adjustments ───────────────────────────── */

const TRANSFER_REASONS: Record<StockTransfer["type"], string[]> = {
  replenishment: ["Pick face below min", "Wave replenishment", "Forecasted demand spike"],
  internal: ["Slotting optimisation", "Consolidate partial pallets", "Location maintenance", "Re-slot to golden zone"],
  "inter-warehouse": ["Rebalance network stock", "Customer allocation", "Stock-out recovery"],
};

export function generateTransfers(inventory: InventoryRecord[], employees: Employee[]): StockTransfer[] {
  const out: StockTransfer[] = [];
  let seq = 31800;
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(5500 + wi);
    const stock = inventory.filter((r) => r.warehouseId === wh.id && r.total > 20);
    const staff = employees.filter((e) => e.warehouseId === wh.id);
    const ctrl = staff.filter((e) => ["Inventory Controller", "Shift Supervisor", "Warehouse Manager"].includes(e.role));
    const drivers = staff.filter((e) => e.role === "Forklift Operator" || e.role === "Picker");
    for (let i = 0; i < COUNTS[wh.id].transfers; i++) {
      const type = rng.weighted<StockTransfer["type"]>([["replenishment", 5], ["internal", 3], ["inter-warehouse", 1.4]]);
      const status = rng.weighted<TransferStatus>([["requested", 3], ["in_transit", 2.5], ["completed", 5], ["draft", 0.8], ["cancelled", 0.4]]);
      const src = rng.pick(stock);
      const others = WAREHOUSES.filter((w) => w.id !== wh.id);
      const prefix = wh.id.slice(3);
      const toLocation =
        type === "inter-warehouse"
          ? `${rng.pick(others).id.slice(3)}-R-STG-01`
          : type === "replenishment"
            ? `${prefix}-A-${String(rng.int(1, 3)).padStart(2, "0")}-${String(rng.int(1, 6)).padStart(2, "0")}-${rng.pick(["A", "B", "C"])}-01`
            : `${prefix}-B-${String(rng.int(1, 2)).padStart(2, "0")}-${String(rng.int(1, 5)).padStart(2, "0")}-${rng.pick(["A", "B", "C"])}-01`;
      const createdOffset = -rng.int(1, 24 * 12) * HOUR;
      seq += rng.int(1, 7);
      const lineCount = type === "inter-warehouse" ? rng.int(1, 4) : 1;
      const lines = [src, ...rng.shuffle(stock).slice(0, lineCount - 1)].map((r) => ({
        productId: r.productId,
        sku: r.sku,
        productName: r.productName,
        quantity: Math.max(1, Math.round((r.total * rng.float(0.15, 0.5)) / 5) * 5),
      }));
      out.push({
        id: `TR-${seq}`,
        warehouseId: wh.id,
        type,
        fromLocation: src.locationCode,
        toLocation,
        lines,
        status,
        requestedBy: ctrl.length ? rng.pick(ctrl).name : "System",
        assignedTo: status === "in_transit" || status === "completed" ? rng.pick(drivers.length ? drivers : staff).name : undefined,
        createdAt: at(createdOffset),
        completedAt: status === "completed" ? at(createdOffset + rng.int(1, 30) * HOUR) : undefined,
        reason: rng.pick(TRANSFER_REASONS[type]),
      });
    }
  });
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const ADJ_REASONS: [AdjustmentReason, number][] = [
  ["Cycle count", 8],
  ["Damaged goods", 3],
  ["Expired", 1.2],
  ["Found stock", 1.5],
  ["Shrinkage", 1],
  ["Data correction", 1.4],
  ["Return to stock", 1.6],
];

export function generateAdjustments(inventory: InventoryRecord[], products: Product[], employees: Employee[]): StockAdjustment[] {
  const out: StockAdjustment[] = [];
  const cost = new Map(products.map((p) => [p.id, p.unitCost]));
  let seq = 9120;
  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(6600 + wi);
    const stock = inventory.filter((r) => r.warehouseId === wh.id && r.total > 0);
    const staff = employees.filter((e) => e.warehouseId === wh.id);
    const counters = staff.filter((e) => ["Inventory Controller", "Receiver", "Picker"].includes(e.role));
    const approvers = staff.filter((e) => ["Shift Supervisor", "Warehouse Manager"].includes(e.role));
    for (let i = 0; i < COUNTS[wh.id].adjustments; i++) {
      const r = rng.pick(stock);
      const reason = rng.weighted(ADJ_REASONS);
      const positive = reason === "Found stock" || reason === "Return to stock" || (reason === "Cycle count" && rng.chance(0.4)) || (reason === "Data correction" && rng.chance(0.5));
      const delta = Math.max(1, Math.round(r.total * rng.float(0.005, 0.06)) || 1) * (positive ? 1 : -1);
      const status = i < 5 ? "pending" : rng.weighted<StockAdjustment["status"]>([["approved", 9], ["rejected", 0.8], ["pending", 0.6]]);
      seq += rng.int(1, 4);
      out.push({
        id: `ADJ-${seq}`,
        warehouseId: wh.id,
        productId: r.productId,
        sku: r.sku,
        productName: r.productName,
        locationCode: r.locationCode,
        before: r.total,
        after: Math.max(0, r.total + delta),
        reason,
        note: rng.chance(0.35)
          ? rng.pick(["Recount confirmed by supervisor.", "Carton crushed by forklift tines.", "Mis-pick from adjacent bin.", "Found behind pallet in adjacent location.", "Customer return inspected — grade A."])
          : undefined,
        requestedBy: counters.length ? rng.pick(counters).name : staff[0].name,
        approvedBy: status === "approved" && approvers.length ? rng.pick(approvers).name : undefined,
        createdAt: at(-rng.int(i < 5 ? 1 : 6, i < 5 ? 20 : 24 * 21) * HOUR - rng.int(0, 59) * 60000),
        status,
        valueImpact: Number((delta * (cost.get(r.productId) ?? 10)).toFixed(2)),
      });
    }
  });
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
