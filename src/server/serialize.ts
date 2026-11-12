import "server-only";
import type * as P from "@prisma/client";
import type * as T from "@/types";

/**
 * Database rows → the frontend's domain types (src/types). Keeping the wire format equal
 * to the types the UI already uses means pages don't care where data comes from.
 */
const iso = (d: Date) => d.toISOString();
const isoOpt = (d: Date | null) => (d ? d.toISOString() : undefined);
const opt = <V,>(v: V | null) => (v === null ? undefined : v);

export const toWarehouse = (w: P.Warehouse) => ({ id: w.id, name: w.name, city: w.city, timezone: w.timezone, stockLevelFactor: w.stockLevelFactor, active: w.active });

export const toZone = (z: P.Zone): T.Zone => ({ id: z.id, warehouseId: z.warehouseId, code: z.code, name: z.name, type: z.type as T.LocationType, temperature: opt(z.temperature) });

export const toLocation = (l: P.Location, productIds: string[] = []): T.Location => ({
  id: l.id, code: l.code, warehouseId: l.warehouseId, zone: l.zone, aisle: l.aisle, rack: l.rack, shelf: l.shelf, bin: l.bin,
  type: l.type as T.LocationType, capacity: l.capacity, occupied: l.occupied, status: l.status as T.LocationStatus, productIds, lastCountedAt: iso(l.lastCountedAt),
});

export const toProduct = (p: P.Product): T.Product => ({
  id: p.id, sku: p.sku, name: p.name, barcode: p.barcode, category: p.category as T.Category, brand: p.brand, description: p.description,
  uom: p.uom as T.UnitOfMeasure, unitsPerCase: p.unitsPerCase, weightKg: p.weightKg, dimensions: { length: p.lengthCm, width: p.widthCm, height: p.heightCm },
  minStock: p.minStock, maxStock: p.maxStock, reorderQty: p.reorderQty, supplierId: p.supplierId, unitCost: p.unitCost, unitPrice: p.unitPrice,
  storage: p.storage as T.StorageCondition, status: p.status as T.ProductStatus, imageUrl: opt(p.imageUrl), createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
});

export const toSupplier = (s: P.Supplier): T.Supplier => ({ ...s, categories: s.categories as T.Category[], status: s.status as T.Supplier["status"] });

export const toCustomer = (c: P.Customer): T.Customer => ({
  ...c, type: c.type as T.CustomerType, slaTier: c.slaTier as T.SlaTier, address: c.address as unknown as T.Address, status: c.status as T.Customer["status"],
});

export const toInventory = (r: P.InventoryRecord & { product: Pick<P.Product, "sku" | "name" | "category"> }): T.InventoryRecord => ({
  id: r.id, warehouseId: r.warehouseId, productId: r.productId, sku: r.product.sku, productName: r.product.name, category: r.product.category as T.Category,
  locationId: r.locationId, locationCode: r.locationCode, lot: r.lot, expiresAt: isoOpt(r.expiresAt), available: r.available, reserved: r.reserved,
  total: r.total, status: r.status as T.StockStatus, updatedAt: iso(r.updatedAt),
});

export const toInbound = (s: P.InboundShipment & { lines: P.InboundLine[] }): T.InboundShipment => ({
  id: s.id, warehouseId: s.warehouseId, poNumber: s.poNumber, supplierId: s.supplierId, supplierName: s.supplierName, carrier: s.carrier,
  trackingNumber: s.trackingNumber, dock: opt(s.dock), expectedAt: iso(s.expectedAt), arrivedAt: isoOpt(s.arrivedAt), completedAt: isoOpt(s.completedAt),
  status: s.status as T.InboundStatus, priority: s.priority as T.Priority, pallets: s.pallets, notes: opt(s.notes),
  lines: [...s.lines].sort((a, b) => a.position - b.position).map((l) => ({ productId: l.productId, sku: l.sku, productName: l.productName, expected: l.expected, received: l.received, damaged: l.damaged })),
});

export const toOrder = (o: P.Order & { lines: P.OrderLine[] }): T.Order => ({
  id: o.id, warehouseId: o.warehouseId, customerId: o.customerId, customerName: o.customerName, channel: o.channel as T.SalesChannel,
  createdAt: iso(o.createdAt), requestedShipAt: iso(o.requestedShipAt), shippedAt: isoOpt(o.shippedAt), priority: o.priority as T.Priority,
  status: o.status as T.OrderStatus, shippingAddress: o.shippingAddress as unknown as T.Address, carrier: o.carrier, service: o.service,
  trackingNumber: opt(o.trackingNumber), weightKg: o.weightKg, cartons: o.cartons, notes: opt(o.notes),
  lines: [...o.lines].sort((a, b) => a.position - b.position).map((l) => ({
    productId: l.productId, sku: l.sku, productName: l.productName, locationCode: l.locationCode, quantity: l.quantity, picked: l.picked, packed: l.packed, unitPrice: l.unitPrice,
  })),
});

export const toPickTask = (t: P.PickTask & { lines: P.PickLine[] }): T.PickTask => ({
  id: t.id, warehouseId: t.warehouseId, orderId: t.orderId, customerName: t.customerName, type: t.type as T.PickTask["type"], zone: t.zone,
  assigneeId: opt(t.assigneeId), assigneeName: opt(t.assigneeName), priority: t.priority as T.Priority, status: t.status as T.TaskStatus,
  createdAt: iso(t.createdAt), startedAt: isoOpt(t.startedAt), dueAt: iso(t.dueAt), cart: opt(t.cart),
  lines: [...t.lines].sort((a, b) => a.position - b.position).map((l) => ({ sku: l.sku, productName: l.productName, locationCode: l.locationCode, quantity: l.quantity, picked: l.picked, uom: l.uom as T.UnitOfMeasure })),
});

export const toTransfer = (t: P.StockTransfer & { lines: P.TransferLine[] }): T.StockTransfer => ({
  id: t.id, warehouseId: t.warehouseId, type: t.type as T.StockTransfer["type"], fromLocation: t.fromLocation, toLocation: t.toLocation,
  status: t.status as T.TransferStatus, requestedBy: t.requestedBy, assignedTo: opt(t.assignedTo), createdAt: iso(t.createdAt), completedAt: isoOpt(t.completedAt), reason: t.reason,
  lines: [...t.lines].sort((a, b) => a.position - b.position).map((l) => ({ productId: l.productId, sku: l.sku, productName: l.productName, quantity: l.quantity })),
});

export const toAdjustment = (a: P.StockAdjustment): T.StockAdjustment => ({
  ...a, reason: a.reason as T.AdjustmentReason, note: opt(a.note), approvedBy: opt(a.approvedBy), createdAt: iso(a.createdAt), status: a.status as T.StockAdjustment["status"],
});

export const toEmployee = (e: P.Employee): T.Employee => ({
  ...e, role: e.role as T.EmployeeRole, shift: e.shift as T.Employee["shift"], status: e.status as T.Employee["status"], device: opt(e.device), hiredAt: iso(e.hiredAt),
});

export const toActivity = (e: P.ActivityEvent): T.ActivityEvent => ({
  ...e, timestamp: iso(e.timestamp), module: e.module as T.LogModule, severity: e.severity as T.ActivityEvent["severity"], source: e.source as T.ActivityEvent["source"],
});

export const toNotification = (n: P.Notification): T.AppNotification => ({
  id: n.id, title: n.title, body: n.body, timestamp: iso(n.timestamp), kind: n.kind as T.AppNotification["kind"], read: n.read, href: n.href,
});

export const toMetric = (m: P.DailyMetric): T.DailyMetric => {
  const { warehouseId: _w, ...rest } = m;
  return rest;
};

export const toUser = (u: P.User) => ({
  id: u.id, login: u.login, email: u.email, name: u.name, role: u.role, warehouseId: u.warehouseId, employeeId: u.employeeId,
  active: u.active, lastLoginAt: isoOpt(u.lastLoginAt), createdAt: iso(u.createdAt),
});
