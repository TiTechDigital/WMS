import type { useWms } from "@/store/wms-store";
import { REFERENCE_NOW } from "@/lib/constants";

type Store = ReturnType<typeof useWms>;
export type ReportRow = Record<string, string | number>;

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  category: "Inventory" | "Operations" | "Financial" | "Workforce";
  build: (s: Store) => ReportRow[];
}

const daysSince = (iso: string) => Math.round((REFERENCE_NOW.getTime() - new Date(iso).getTime()) / 86400000);

export const REPORTS: ReportDef[] = [
  {
    id: "soh",
    name: "Stock on hand by location",
    description: "Every SKU/location/lot with available, reserved and total quantities.",
    category: "Inventory",
    build: (s) => s.inventory.map((r) => ({ sku: r.sku, product: r.productName, category: r.category, location: r.locationCode, lot: r.lot, available: r.available, reserved: r.reserved, total: r.total, status: r.status })),
  },
  {
    id: "reorder",
    name: "Low stock & reorder suggestions",
    description: "SKUs below minimum with suggested order quantity and preferred supplier.",
    category: "Inventory",
    build: (s) => {
      const sup = new Map(s.suppliers.map((x) => [x.id, x.name]));
      const totals = new Map<string, number>();
      s.inventory.forEach((r) => totals.set(r.productId, (totals.get(r.productId) ?? 0) + r.total));
      return s.products
        .filter((p) => totals.has(p.id) && (totals.get(p.id) ?? 0) < p.minStock)
        .map((p) => ({ sku: p.sku, product: p.name, on_hand: totals.get(p.id) ?? 0, min: p.minStock, max: p.maxStock, suggested_qty: Math.max(p.reorderQty, p.maxStock - (totals.get(p.id) ?? 0)), supplier: sup.get(p.supplierId) ?? "" }));
    },
  },
  {
    id: "aging",
    name: "Expiry & lot aging",
    description: "Perishable lots with days to expiry, for FEFO rotation and write-off planning.",
    category: "Inventory",
    build: (s) => s.inventory.filter((r) => r.expiresAt).sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!)).map((r) => ({ sku: r.sku, product: r.productName, location: r.locationCode, lot: r.lot, qty: r.total, expires: r.expiresAt!.slice(0, 10), days_to_expiry: -daysSince(r.expiresAt!) })),
  },
  {
    id: "valuation",
    name: "Inventory valuation by category",
    description: "Units and cost value on hand, rolled up by product category.",
    category: "Financial",
    build: (s) => {
      const cost = new Map(s.products.map((p) => [p.id, p.unitCost]));
      const m = new Map<string, { units: number; value: number; skus: Set<string> }>();
      s.inventory.forEach((r) => {
        const e = m.get(r.category) ?? { units: 0, value: 0, skus: new Set() };
        e.units += r.total;
        e.value += r.total * (cost.get(r.productId) ?? 0);
        e.skus.add(r.productId);
        m.set(r.category, e);
      });
      return [...m.entries()].map(([category, e]) => ({ category, skus: e.skus.size, units: e.units, value_usd: e.value.toFixed(2) }));
    },
  },
  {
    id: "adjustments",
    name: "Adjustment audit trail",
    description: "All stock adjustments with reason codes, approvers and value impact.",
    category: "Financial",
    build: (s) => s.adjustments.map((a) => ({ id: a.id, date: a.createdAt, sku: a.sku, location: a.locationCode, before: a.before, after: a.after, reason: a.reason, value_usd: a.valueImpact, requested_by: a.requestedBy, approved_by: a.approvedBy ?? "", status: a.status })),
  },
  {
    id: "receipts",
    name: "Inbound receipts & discrepancies",
    description: "ASN-level expected vs received quantities, damages and dock-to-stock status.",
    category: "Operations",
    build: (s) => s.inbound.map((i) => { const e = i.lines.reduce((a, l) => a + l.expected, 0); const r = i.lines.reduce((a, l) => a + l.received, 0); return { asn: i.id, po: i.poNumber, supplier: i.supplierName, expected_at: i.expectedAt, arrived_at: i.arrivedAt ?? "", expected: e, received: r, variance: r - e, damaged: i.lines.reduce((a, l) => a + l.damaged, 0), status: i.status }; }),
  },
  {
    id: "sla",
    name: "Order fulfillment SLA",
    description: "Order cycle times and on-time status against requested ship dates.",
    category: "Operations",
    build: (s) => s.orders.map((o) => ({ order: o.id, customer: o.customerName, priority: o.priority, created: o.createdAt, ship_by: o.requestedShipAt, shipped: o.shippedAt ?? "", on_time: o.shippedAt ? (o.shippedAt <= o.requestedShipAt ? "yes" : "no") : "open", status: o.status })),
  },
  {
    id: "utilization",
    name: "Location utilization",
    description: "Capacity and occupancy for every storage position, with blocked locations.",
    category: "Operations",
    build: (s) => s.locations.map((l) => ({ location: l.code, zone: l.zone, type: l.type, capacity: l.capacity, occupied: l.occupied, utilization_pct: l.capacity ? ((l.occupied / l.capacity) * 100).toFixed(1) : "0", status: l.status })),
  },
  {
    id: "productivity",
    name: "Operator productivity",
    description: "Units per hour, accuracy and task counts per operator for the current shift.",
    category: "Workforce",
    build: (s) => s.employees.map((e) => ({ badge: e.badge, name: e.name, role: e.role, shift: e.shift, units_per_hour: e.unitsPerHour, accuracy_pct: e.accuracy, tasks_today: e.tasksToday, status: e.status })),
  },
  {
    id: "kpi",
    name: "Daily KPI summary",
    description: "180 days of throughput, accuracy, on-time and utilization metrics.",
    category: "Operations",
    build: (s) => s.metrics.map((m) => ({ ...m })),
  },
];
