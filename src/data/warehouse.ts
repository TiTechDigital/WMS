import type { InventoryRecord, Location, LocationType, Product, StockStatus, Zone } from "@/types";
import type { WarehouseId } from "@/lib/constants";
import { REFERENCE_NOW, WAREHOUSES } from "@/lib/constants";
import { createRng, type Rng } from "@/lib/random";

type ZoneSpec = { code: string; name: string; type: LocationType; aisles: number; racks: number; levels: number; temperature?: string };

/** Physical layout per site. Warehouse → Zone → Aisle → Rack → Shelf (level) → Bin. */
export const LAYOUTS: Record<WarehouseId, ZoneSpec[]> = {
  "WH-ATL": [
    { code: "A", name: "Fast Pick", type: "pick-bin", aisles: 4, racks: 6, levels: 4 },
    { code: "B", name: "Reserve Pallet", type: "pallet", aisles: 3, racks: 6, levels: 3 },
    { code: "C", name: "Bulk Floor", type: "bulk", aisles: 1, racks: 10, levels: 1 },
    { code: "D", name: "Cold Storage", type: "cold", aisles: 2, racks: 5, levels: 3, temperature: "2–6 °C" },
    { code: "R", name: "Receiving", type: "staging", aisles: 1, racks: 6, levels: 1 },
    { code: "S", name: "Shipping", type: "staging", aisles: 1, racks: 6, levels: 1 },
    { code: "DK", name: "Dock Doors", type: "dock", aisles: 1, racks: 10, levels: 1 },
  ],
  "WH-DAL": [
    { code: "A", name: "Fast Pick", type: "pick-bin", aisles: 3, racks: 5, levels: 4 },
    { code: "B", name: "Reserve Pallet", type: "pallet", aisles: 2, racks: 5, levels: 3 },
    { code: "C", name: "Bulk Floor", type: "bulk", aisles: 1, racks: 6, levels: 1 },
    { code: "D", name: "Cold Storage", type: "cold", aisles: 1, racks: 4, levels: 3, temperature: "2–6 °C" },
    { code: "R", name: "Receiving", type: "staging", aisles: 1, racks: 4, levels: 1 },
    { code: "S", name: "Shipping", type: "staging", aisles: 1, racks: 4, levels: 1 },
    { code: "DK", name: "Dock Doors", type: "dock", aisles: 1, racks: 6, levels: 1 },
  ],
  "WH-RNO": [
    { code: "A", name: "Fast Pick", type: "pick-bin", aisles: 3, racks: 4, levels: 4 },
    { code: "B", name: "Reserve Pallet", type: "pallet", aisles: 2, racks: 4, levels: 3 },
    { code: "C", name: "Bulk Floor", type: "bulk", aisles: 1, racks: 6, levels: 1 },
    { code: "R", name: "Receiving", type: "staging", aisles: 1, racks: 3, levels: 1 },
    { code: "S", name: "Shipping", type: "staging", aisles: 1, racks: 3, levels: 1 },
    { code: "DK", name: "Dock Doors", type: "dock", aisles: 1, racks: 5, levels: 1 },
  ],
};

const LEVELS = ["A", "B", "C", "D"];
const p2 = (n: number) => String(n).padStart(2, "0");

export function generateZones(): Zone[] {
  return WAREHOUSES.flatMap((wh) =>
    LAYOUTS[wh.id].map((z) => ({
      id: `${wh.id}-${z.code}`,
      warehouseId: wh.id,
      code: z.code,
      name: z.name,
      type: z.type,
      temperature: z.temperature,
    }))
  );
}

function buildLocations(wh: WarehouseId, rng: Rng): Location[] {
  const prefix = wh.slice(3);
  const out: Location[] = [];
  for (const z of LAYOUTS[wh]) {
    for (let a = 1; a <= z.aisles; a++) {
      for (let r = 1; r <= z.racks; r++) {
        for (let l = 0; l < z.levels; l++) {
          const aisle = p2(a);
          const rack = p2(r);
          const shelf = z.levels > 1 ? LEVELS[l] : "F";
          const bin = "01";
          let code: string;
          if (z.type === "dock") code = `${prefix}-DOCK-${rack}`;
          else if (z.type === "staging") code = `${prefix}-${z.code}-STG-${rack}`;
          else if (z.type === "bulk") code = `${prefix}-${z.code}-LANE-${rack}`;
          else code = `${prefix}-${z.code}-${aisle}-${rack}-${shelf}-${bin}`;
          out.push({
            id: `loc_${code}`,
            code,
            warehouseId: wh,
            zone: z.code,
            aisle,
            rack,
            shelf,
            bin,
            type: z.type,
            capacity: 0,
            occupied: 0,
            status: "active",
            productIds: [],
            lastCountedAt: new Date(REFERENCE_NOW.getTime() - rng.int(1, 90) * 86400000).toISOString(),
          });
        }
      }
    }
  }
  return out;
}

const DEFAULT_CAPACITY: Record<LocationType, number> = {
  "pick-bin": 120,
  pallet: 480,
  bulk: 1600,
  cold: 240,
  staging: 24,
  dock: 1,
};

export function stockStatus(total: number, min: number, max: number): StockStatus {
  if (total <= 0) return "out_of_stock";
  if (total < min) return "low_stock";
  if (total > max) return "overstock";
  return "in_stock";
}

export function generateWarehouseStock(products: Product[]) {
  const locations: Location[] = [];
  const inventory: InventoryRecord[] = [];
  const scale: Record<WarehouseId, number> = { "WH-ATL": 1, "WH-DAL": 0.55, "WH-RNO": 0.42 };
  const coverage: Record<WarehouseId, number> = { "WH-ATL": 1, "WH-DAL": 0.72, "WH-RNO": 0.58 };

  WAREHOUSES.forEach((wh, wi) => {
    const rng = createRng(900 + wi * 31);
    const locs = buildLocations(wh.id, rng);
    const free = (type: LocationType) => locs.filter((l) => l.type === type && l.productIds.length === 0 && l.status === "active");

    // Randomly block a few locations for realism
    locs.forEach((l) => {
      if (l.type === "pick-bin" || l.type === "pallet") {
        if (rng.chance(0.018)) l.status = "blocked";
        else if (rng.chance(0.012)) l.status = "maintenance";
      }
    });

    const stocked = products.filter((p) => p.status !== "draft" && (wi === 0 || rng.chance(coverage[wh.id])));
    const isCold = (p: Product) => p.storage === "chilled";
    const hasCold = LAYOUTS[wh.id].some((z) => z.type === "cold");
    let invSeq = 0;

    for (const p of stocked) {
      if (isCold(p) && !hasCold) continue;
      // Decide stock profile for the product
      const profile = rng.weighted<StockStatus>([
        ["in_stock", 78],
        ["low_stock", 12],
        ["out_of_stock", p.status === "discontinued" ? 30 : 3.5],
        ["overstock", 6],
      ]);
      const min = Math.round(p.minStock * scale[wh.id]);
      const max = Math.round(p.maxStock * scale[wh.id]);
      let target =
        profile === "in_stock"
          ? rng.int(Math.round(min * 1.3), Math.round(max * 0.85))
          : profile === "low_stock"
            ? rng.int(Math.round(min * 0.15), Math.round(min * 0.9))
            : profile === "out_of_stock"
              ? 0
              : rng.int(Math.round(max * 1.05), Math.round(max * 1.35));

      // Choose locations: pick face + optional reserve
      const bulky = p.weightKg >= 9 || p.dimensions.length >= 90;
      const pickType: LocationType = isCold(p) ? "cold" : bulky ? "bulk" : "pick-bin";
      const pickPool = free(pickType);
      const pickFace = pickPool.length ? pickPool[rng.int(0, Math.min(pickPool.length - 1, 12))] : undefined;
      if (!pickFace) continue;
      const slots: Location[] = [pickFace];
      if (target > min * 1.4 && !bulky) {
        const reservePool = free(isCold(p) ? "cold" : "pallet");
        if (reservePool.length && rng.chance(isCold(p) ? 0.6 : 0.85)) slots.push(reservePool[rng.int(0, Math.min(reservePool.length - 1, 10))]);
      }

      const pickShare = slots.length > 1 ? rng.float(0.18, 0.4) : 1;
      const splits = slots.length > 1 ? [Math.round(target * pickShare), target - Math.round(target * pickShare)] : [target];

      slots.forEach((loc, i) => {
        const qty = splits[i];
        const occPct = qty === 0 ? 0 : rng.float(0.58, 0.98);
        loc.capacity = qty === 0 ? Math.max(DEFAULT_CAPACITY[loc.type], Math.round(max * 0.35)) : Math.max(qty + 1, Math.ceil(qty / occPct));
        loc.occupied = qty;
        loc.productIds.push(p.id);
        const reserved = qty > 0 && i === 0 ? Math.min(qty, Math.round(qty * rng.float(0, 0.32))) : 0;
        const perishable = p.category === "Food & Beverage" || p.category === "Health & Beauty";
        const updated = new Date(REFERENCE_NOW.getTime() - rng.int(5, 60 * 24 * 9) * 60000);
        invSeq++;
        inventory.push({
          id: `inv_${wh.id.slice(3)}_${invSeq}`,
          warehouseId: wh.id,
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          category: p.category,
          locationId: loc.id,
          locationCode: loc.code,
          lot: `L26${p2(rng.int(20, 44))}-${rng.int(1000, 9999)}`,
          expiresAt: perishable ? new Date(REFERENCE_NOW.getTime() + rng.int(isCold(p) ? 4 : 30, isCold(p) ? 40 : 540) * 86400000).toISOString() : undefined,
          available: qty - reserved,
          reserved,
          total: qty,
          status: "in_stock",
          updatedAt: updated.toISOString(),
        });
      });
      // Product-level status applied to all its rows in this warehouse
      const st = stockStatus(target, min, max);
      inventory.filter((r) => r.productId === p.id && r.warehouseId === wh.id).forEach((r) => (r.status = st));
      target = 0;
    }

    // Unassigned storage: give default capacity
    locs.forEach((l) => {
      if (l.capacity === 0) {
        l.capacity = DEFAULT_CAPACITY[l.type];
        if (l.type === "staging") {
          l.occupied = rng.int(0, l.capacity);
          if (l.code.includes("-R-") && rng.chance(0.3)) l.status = "reserved";
        }
        if (l.type === "dock") l.occupied = rng.chance(0.55) ? 1 : 0;
      }
    });

    locations.push(...locs);
  });

  return { locations, inventory };
}
