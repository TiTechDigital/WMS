"use client";

/**
 * Client-side application store.
 *
 * Holds the working copy of the mock dataset and exposes domain actions (receive, pick,
 * approve, transfer …). Pages never mutate data directly — they call these actions — so
 * swapping this provider for API-backed hooks (React Query / server actions) later is a
 * contained change. See `src/services/README.md`.
 */
import * as React from "react";
import { getSeed } from "@/data";
import { REFERENCE_NOW, WAREHOUSES, type WarehouseId } from "@/lib/constants";
import { stockStatus } from "@/data/warehouse";
import type {
  ActivityEvent,
  AppNotification,
  Customer,
  Employee,
  InboundShipment,
  InventoryRecord,
  Location,
  LocationStatus,
  Order,
  OrderStatus,
  PickTask,
  Priority,
  Product,
  StockAdjustment,
  StockTransfer,
  Supplier,
} from "@/types";
import { INBOUND_STAGES, ORDER_STAGES } from "@/types";

export const CURRENT_USER = {
  name: "Alex Morgan",
  email: "alex.morgan@northstar-logistics.com",
  role: "Operations Manager",
  company: "Northstar Logistics",
};

type Ctx = ReturnType<typeof useStoreValue>;
const StoreContext = React.createContext<Ctx | null>(null);

let idCounter = 1;
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;
/** Monotonic clock for new events: starts at the dataset's reference time and moves forward with real time. */
const bootReal = typeof performance !== "undefined" ? Date.now() : 0;
const nowIso = () => new Date(REFERENCE_NOW.getTime() + Math.max(0, Date.now() - bootReal)).toISOString();

function useStoreValue() {
  const seed = React.useMemo(() => getSeed(), []);
  const [warehouseId, setWarehouseId] = React.useState<WarehouseId>("WH-ATL");
  const [products, setProducts] = React.useState<Product[]>(seed.products);
  const [suppliers, setSuppliers] = React.useState<Supplier[]>(seed.suppliers);
  const [customers, setCustomers] = React.useState<Customer[]>(seed.customers);
  const [employees, setEmployees] = React.useState<Employee[]>(seed.employees);
  const [locations, setLocations] = React.useState<Location[]>(seed.locations);
  const [inventory, setInventory] = React.useState<InventoryRecord[]>(seed.inventory);
  const [inbound, setInbound] = React.useState<InboundShipment[]>(seed.inbound);
  const [orders, setOrders] = React.useState<Order[]>(seed.orders);
  const [pickTasks, setPickTasks] = React.useState<PickTask[]>(seed.pickTasks);
  const [transfers, setTransfers] = React.useState<StockTransfer[]>(seed.transfers);
  const [adjustments, setAdjustments] = React.useState<StockAdjustment[]>(seed.adjustments);
  const [activity, setActivity] = React.useState<ActivityEvent[]>(seed.activity);
  const [notifications, setNotifications] = React.useState<AppNotification[]>(seed.notifications);

  const warehouse = WAREHOUSES.find((w) => w.id === warehouseId)!;

  const log = React.useCallback(
    (e: Omit<ActivityEvent, "id" | "timestamp" | "warehouseId" | "actor" | "actorRole" | "source"> & Partial<Pick<ActivityEvent, "actor" | "actorRole" | "source">>) => {
      setActivity((prev) => [
        { id: uid("evt"), timestamp: nowIso(), warehouseId, actor: CURRENT_USER.name, actorRole: CURRENT_USER.role, source: "Web", ...e },
        ...prev,
      ]);
    },
    [warehouseId]
  );

  /** Adjust on-hand at a location and recompute product-level stock status for the site. */
  const applyStockDelta = React.useCallback(
    (wh: WarehouseId, productId: string, delta: number, locationCode?: string) => {
      setInventory((prev) => {
        const product = products.find((p) => p.id === productId);
        let next = prev.map((r) => r);
        let idx = next.findIndex((r) => r.warehouseId === wh && r.productId === productId && (!locationCode || r.locationCode === locationCode));
        if (idx === -1) {
          if (!product) return prev;
          const loc = locations.find((l) => l.warehouseId === wh && l.code === locationCode);
          const rec: InventoryRecord = {
            id: uid("inv"),
            warehouseId: wh,
            productId,
            sku: product.sku,
            productName: product.name,
            category: product.category,
            locationId: loc?.id ?? "",
            locationCode: locationCode ?? `${wh.slice(3)}-R-STG-01`,
            lot: `L2645-${Math.floor(1000 + Math.random() * 8999)}`,
            available: 0,
            reserved: 0,
            total: 0,
            status: "out_of_stock",
            updatedAt: nowIso(),
          };
          next = [...next, rec];
          idx = next.length - 1;
        }
        const r = next[idx];
        const total = Math.max(0, r.total + delta);
        next[idx] = { ...r, total, available: Math.max(0, total - r.reserved), updatedAt: nowIso() };
        if (product) {
          const scale = wh === "WH-ATL" ? 1 : wh === "WH-DAL" ? 0.55 : 0.42;
          const sum = next.filter((x) => x.warehouseId === wh && x.productId === productId).reduce((s, x) => s + x.total, 0);
          const st = stockStatus(sum, Math.round(product.minStock * scale), Math.round(product.maxStock * scale));
          next = next.map((x) => (x.warehouseId === wh && x.productId === productId ? { ...x, status: st } : x));
        }
        return next;
      });
      if (locationCode) {
        setLocations((prev) => prev.map((l) => (l.warehouseId === wh && l.code === locationCode ? { ...l, occupied: Math.max(0, l.occupied + delta) } : l)));
      }
    },
    [products, locations]
  );

  /* ───────── Catalog ───────── */
  const upsertProduct = React.useCallback(
    (p: Product) => {
      setProducts((prev) => {
        const exists = prev.some((x) => x.id === p.id);
        return exists ? prev.map((x) => (x.id === p.id ? p : x)) : [p, ...prev];
      });
      setInventory((prev) => prev.map((r) => (r.productId === p.id ? { ...r, sku: p.sku, productName: p.name, category: p.category } : r)));
      log({ module: "Products", action: products.some((x) => x.id === p.id) ? "Product updated" : "Product created", entity: p.sku, details: p.name, severity: "info" });
    },
    [log, products]
  );

  const upsertSupplier = React.useCallback(
    (s: Supplier) => {
      setSuppliers((prev) => (prev.some((x) => x.id === s.id) ? prev.map((x) => (x.id === s.id ? s : x)) : [s, ...prev]));
      log({ module: "System", action: "Supplier saved", entity: s.code, details: s.name, severity: "info" });
    },
    [log]
  );
  const upsertCustomer = React.useCallback(
    (c: Customer) => {
      setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev]));
      log({ module: "System", action: "Customer saved", entity: c.code, details: c.name, severity: "info" });
    },
    [log]
  );

  /* ───────── Locations ───────── */
  const setLocationStatus = React.useCallback(
    (id: string, status: LocationStatus) => {
      setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      const loc = locations.find((l) => l.id === id);
      log({ module: "Locations", action: `Location ${status === "active" ? "activated" : status}`, entity: loc?.code ?? id, details: `Status set to ${status}`, severity: status === "active" ? "info" : "warning" });
    },
    [locations, log]
  );

  /* ───────── Inbound ───────── */
  const advanceInbound = React.useCallback(
    (id: string) => {
      const s = inbound.find((x) => x.id === id);
      if (!s) return;
      const i = INBOUND_STAGES.indexOf(s.status);
      if (i < 0 || i >= INBOUND_STAGES.length - 1) return;
      const nextStatus = INBOUND_STAGES[i + 1];
      const patch: Partial<InboundShipment> = { status: nextStatus };
      if (nextStatus === "arrived") {
        patch.arrivedAt = nowIso();
        patch.dock = s.dock ?? `DOCK-0${1 + (id.charCodeAt(id.length - 1) % 6)}`;
      }
      if (nextStatus === "quality_check") patch.lines = s.lines.map((l) => ({ ...l, received: l.received || l.expected }));
      if (nextStatus === "completed") {
        patch.completedAt = nowIso();
        s.lines.forEach((l) => {
          const target = inventory.find((r) => r.warehouseId === s.warehouseId && r.productId === l.productId);
          applyStockDelta(s.warehouseId, l.productId, Math.max(0, l.received - l.damaged), target?.locationCode);
        });
      }
      setInbound((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      log({ module: "Inbound", action: `ASN moved to ${nextStatus.replace("_", " ")}`, entity: id, details: `${s.poNumber} · ${s.supplierName}`, severity: nextStatus === "completed" ? "success" : "info" });
      return nextStatus;
    },
    [inbound, inventory, applyStockDelta, log]
  );

  const updateInboundLine = React.useCallback((id: string, sku: string, received: number, damaged: number) => {
    setInbound((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === "arrived" ? "receiving" : s.status, lines: s.lines.map((l) => (l.sku === sku ? { ...l, received, damaged } : l)) }
          : s
      )
    );
  }, []);

  const createInbound = React.useCallback(
    (s: InboundShipment) => {
      setInbound((prev) => [...prev, s].sort((a, b) => a.expectedAt.localeCompare(b.expectedAt)));
      log({ module: "Inbound", action: "ASN created", entity: s.id, details: `${s.poNumber} · ${s.supplierName}`, severity: "info" });
    },
    [log]
  );

  /* ───────── Orders / Outbound ───────── */
  const setOrderStatus = React.useCallback(
    (id: string, status: OrderStatus) => {
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const picked = ["packing", "ready_to_ship", "shipped", "delivered"].includes(status);
          const packed = ["ready_to_ship", "shipped", "delivered"].includes(status);
          return {
            ...o,
            status,
            lines: o.lines.map((l) => ({ ...l, picked: picked ? l.quantity : l.picked, packed: packed ? l.quantity : l.packed })),
            shippedAt: status === "shipped" ? nowIso() : o.shippedAt,
            trackingNumber: packed && !o.trackingNumber ? `1Z${Math.floor(100000 + Math.random() * 899999)}A${Math.floor(10000000 + Math.random() * 89999999)}` : o.trackingNumber,
          };
        })
      );
      if (status === "picking") setPickTasks((prev) => prev.map((t) => (t.orderId === id && t.status === "queued" ? { ...t, status: "in_progress", startedAt: nowIso() } : t)));
      if (["packing", "ready_to_ship", "shipped"].includes(status))
        setPickTasks((prev) => prev.map((t) => (t.orderId === id ? { ...t, status: "completed", lines: t.lines.map((l) => ({ ...l, picked: l.quantity })) } : t)));
      log({ module: "Outbound", action: `Order ${status.replace(/_/g, " ")}`, entity: id, details: `Status changed to ${status.replace(/_/g, " ")}`, severity: status === "shipped" ? "success" : status === "cancelled" ? "warning" : "info" });
    },
    [log]
  );

  const advanceOrder = React.useCallback(
    (id: string) => {
      const o = orders.find((x) => x.id === id);
      if (!o) return;
      const i = (ORDER_STAGES as readonly string[]).indexOf(o.status);
      if (o.status === "on_hold") return setOrderStatus(id, "new"), "new" as OrderStatus;
      if (i < 0 || i >= ORDER_STAGES.length - 1) return;
      const next = ORDER_STAGES[i + 1];
      if (next === "allocated" && !pickTasks.some((t) => t.orderId === id)) {
        setPickTasks((prev) => [
          {
            id: `PK-${77000 + Math.floor(Math.random() * 999)}`,
            warehouseId: o.warehouseId,
            orderId: o.id,
            customerName: o.customerName,
            type: o.lines.length > 4 ? "batch" : "single",
            zone: o.lines[0]?.locationCode.split("-")[1] ?? "A",
            priority: o.priority,
            status: "queued",
            createdAt: nowIso(),
            dueAt: o.requestedShipAt,
            lines: o.lines.map((l) => ({ sku: l.sku, productName: l.productName, locationCode: l.locationCode, quantity: l.quantity, picked: 0, uom: products.find((p) => p.id === l.productId)?.uom ?? "EA" })),
          },
          ...prev,
        ]);
      }
      setOrderStatus(id, next);
      return next;
    },
    [orders, pickTasks, products, setOrderStatus]
  );

  const setOrderPriority = React.useCallback(
    (id: string, priority: Priority) => {
      setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, priority } : o)));
      setPickTasks((prev) => prev.map((t) => (t.orderId === id ? { ...t, priority } : t)));
      log({ module: "Outbound", action: "Priority changed", entity: id, details: `Priority set to ${priority}`, severity: "info" });
    },
    [log]
  );

  const createOrder = React.useCallback(
    (o: Order) => {
      setOrders((prev) => [o, ...prev]);
      log({ module: "Outbound", action: "Order created", entity: o.id, details: `${o.customerName} · ${o.lines.length} lines`, severity: "info" });
    },
    [log]
  );

  /* ───────── Picking ───────── */
  const assignTask = React.useCallback(
    (taskId: string, employee: Employee) => {
      setPickTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, assigneeId: employee.id, assigneeName: employee.name } : t)));
      log({ module: "Picking", action: "Task assigned", entity: taskId, details: `Assigned to ${employee.name}`, severity: "info" });
    },
    [log]
  );

  const setTaskStatus = React.useCallback(
    (taskId: string, status: PickTask["status"]) => {
      const task = pickTasks.find((t) => t.id === taskId);
      setPickTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status, startedAt: t.startedAt ?? (status === "in_progress" ? nowIso() : undefined), cart: t.cart ?? (status === "in_progress" ? `CART-${10 + (taskId.charCodeAt(4) % 38)}` : undefined) } : t))
      );
      if (task && status === "in_progress") setOrders((prev) => prev.map((o) => (o.id === task.orderId && (o.status === "allocated" || o.status === "new") ? { ...o, status: "picking" } : o)));
      log({ module: "Picking", action: status === "in_progress" ? "Task started" : status === "paused" ? "Task paused" : "Task updated", entity: taskId, details: task?.orderId ?? "", severity: "info" });
    },
    [pickTasks, log]
  );

  /** Confirm picked quantity for a task line; completes the task and moves the order to packing when done. */
  const confirmPick = React.useCallback(
    (taskId: string, lineIndex: number, qty: number) => {
      const task = pickTasks.find((t) => t.id === taskId);
      if (!task) return { completed: false };
      const lines = task.lines.map((l, i) => (i === lineIndex ? { ...l, picked: Math.min(l.quantity, qty) } : l));
      const completed = lines.every((l) => l.picked >= l.quantity);
      const line = lines[lineIndex];
      setPickTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, lines, status: completed ? "completed" : "in_progress", startedAt: t.startedAt ?? nowIso() } : t)));
      setOrders((prev) =>
        prev.map((o) =>
          o.id === task.orderId
            ? {
                ...o,
                status: completed ? "packing" : o.status === "allocated" || o.status === "new" ? "picking" : o.status,
                lines: o.lines.map((l) => (l.sku === line.sku && l.locationCode === line.locationCode ? { ...l, picked: line.picked } : l)),
              }
            : o
        )
      );
      log({
        module: "Picking",
        action: completed ? "Pick task completed" : "Line picked",
        entity: taskId,
        details: completed ? `${task.orderId} released to packing` : `${line.sku} × ${line.picked} from ${line.locationCode}`,
        severity: completed ? "success" : "info",
        source: "RF Scanner",
      });
      return { completed };
    },
    [pickTasks, log]
  );

  /* ───────── Transfers ───────── */
  const createTransfer = React.useCallback(
    (t: StockTransfer) => {
      setTransfers((prev) => [t, ...prev]);
      log({ module: "Transfers", action: "Transfer requested", entity: t.id, details: `${t.lines[0]?.sku} · ${t.fromLocation} → ${t.toLocation}`, severity: "info" });
    },
    [log]
  );
  const setTransferStatus = React.useCallback(
    (id: string, status: StockTransfer["status"]) => {
      const t = transfers.find((x) => x.id === id);
      if (!t) return;
      setTransfers((prev) => prev.map((x) => (x.id === id ? { ...x, status, completedAt: status === "completed" ? nowIso() : x.completedAt, assignedTo: x.assignedTo ?? (status === "in_transit" ? CURRENT_USER.name : undefined) } : x)));
      if (status === "completed") {
        t.lines.forEach((l) => {
          applyStockDelta(t.warehouseId, l.productId, -l.quantity, t.fromLocation);
          if (t.type !== "inter-warehouse") applyStockDelta(t.warehouseId, l.productId, l.quantity, t.toLocation);
        });
      }
      log({ module: "Transfers", action: `Transfer ${status.replace("_", " ")}`, entity: id, details: `${t.fromLocation} → ${t.toLocation}`, severity: status === "completed" ? "success" : status === "cancelled" ? "warning" : "info" });
    },
    [transfers, applyStockDelta, log]
  );

  /* ───────── Adjustments ───────── */
  const createAdjustment = React.useCallback(
    (a: StockAdjustment, postNow = false) => {
      const rec = postNow ? { ...a, status: "approved" as const, approvedBy: CURRENT_USER.name } : a;
      setAdjustments((prev) => [rec, ...prev]);
      if (postNow) applyStockDelta(a.warehouseId, a.productId, a.after - a.before, a.locationCode);
      log({ module: "Adjustments", action: postNow ? "Adjustment posted" : "Adjustment submitted", entity: a.id, details: `${a.sku} ${a.after - a.before >= 0 ? "+" : ""}${a.after - a.before} · ${a.reason}`, severity: postNow ? "success" : "info" });
    },
    [log, applyStockDelta]
  );
  const reviewAdjustment = React.useCallback(
    (id: string, decision: "approved" | "rejected") => {
      const a = adjustments.find((x) => x.id === id);
      if (!a || a.status !== "pending") return;
      setAdjustments((prev) => prev.map((x) => (x.id === id ? { ...x, status: decision, approvedBy: decision === "approved" ? CURRENT_USER.name : undefined } : x)));
      if (decision === "approved") applyStockDelta(a.warehouseId, a.productId, a.after - a.before, a.locationCode);
      log({ module: "Adjustments", action: decision === "approved" ? "Adjustment posted" : "Adjustment rejected", entity: id, details: `${a.sku} ${a.after - a.before >= 0 ? "+" : ""}${a.after - a.before}`, severity: decision === "approved" ? "success" : "warning" });
    },
    [adjustments, applyStockDelta, log]
  );

  /* ───────── People ───────── */
  const setEmployeeStatus = React.useCallback(
    (id: string, status: Employee["status"]) => {
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
      const e = employees.find((x) => x.id === id);
      log({ module: "Users", action: "Operator status changed", entity: e?.badge ?? id, details: `${e?.name} → ${status.replace("_", " ")}`, severity: "info" });
    },
    [employees, log]
  );
  const upsertEmployee = React.useCallback(
    (e: Employee) => {
      setEmployees((prev) => (prev.some((x) => x.id === e.id) ? prev.map((x) => (x.id === e.id ? e : x)) : [e, ...prev]));
      log({ module: "Users", action: "Operator saved", entity: e.badge, details: `${e.name} · ${e.role}`, severity: "info" });
    },
    [log]
  );

  /* ───────── Notifications ───────── */
  const markNotificationRead = React.useCallback((id: string) => setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n))), []);
  const markAllNotificationsRead = React.useCallback(() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true }))), []);
  const dismissNotification = React.useCallback((id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id)), []);

  /* ───────── Warehouse-scoped views ───────── */
  const scoped = React.useMemo(() => {
    const w = <T extends { warehouseId: WarehouseId }>(arr: T[]) => arr.filter((x) => x.warehouseId === warehouseId);
    return {
      inventory: w(inventory),
      locations: w(locations),
      inbound: w(inbound),
      orders: w(orders),
      pickTasks: w(pickTasks),
      transfers: w(transfers),
      adjustments: w(adjustments),
      activity: w(activity),
      employees: w(employees),
      zones: seed.zones.filter((z) => z.warehouseId === warehouseId),
      metrics: seed.metrics[warehouseId],
    };
  }, [warehouseId, inventory, locations, inbound, orders, pickTasks, transfers, adjustments, activity, employees, seed]);

  return {
    warehouse,
    warehouseId,
    setWarehouseId,
    all: { products, suppliers, customers, employees, locations, inventory, inbound, orders, pickTasks, transfers, adjustments, activity, metrics: seed.metrics },
    products,
    suppliers,
    customers,
    notifications,
    ...scoped,
    actions: {
      log,
      upsertProduct,
      upsertSupplier,
      upsertCustomer,
      setLocationStatus,
      advanceInbound,
      updateInboundLine,
      createInbound,
      advanceOrder,
      setOrderStatus,
      setOrderPriority,
      createOrder,
      assignTask,
      setTaskStatus,
      confirmPick,
      createTransfer,
      setTransferStatus,
      createAdjustment,
      reviewAdjustment,
      setEmployeeStatus,
      upsertEmployee,
      markNotificationRead,
      markAllNotificationsRead,
      dismissNotification,
    },
  };
}

export function WmsStoreProvider({ children }: { children: React.ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useWms() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useWms must be used inside <WmsStoreProvider>");
  return ctx;
}

export { uid, nowIso };
