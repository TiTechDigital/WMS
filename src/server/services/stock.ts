import "server-only";
import type { Tx } from "./common";

export function stockStatus(total: number, min: number, max: number) {
  if (total <= 0) return "out_of_stock";
  if (total < min) return "low_stock";
  if (total > max) return "overstock";
  return "in_stock";
}

/**
 * Change on-hand quantity for a product at a site (optionally at a specific location),
 * keep location occupancy in sync and recompute the product's stock status for the site.
 */
export async function applyStockDelta(tx: Tx, warehouseId: string, productId: string, delta: number, locationCode?: string) {
  const [product, warehouse] = await Promise.all([
    tx.product.findUniqueOrThrow({ where: { id: productId } }),
    tx.warehouse.findUniqueOrThrow({ where: { id: warehouseId } }),
  ]);
  let record = await tx.inventoryRecord.findFirst({
    where: { warehouseId, productId, ...(locationCode ? { locationCode } : {}) },
    orderBy: { total: "desc" },
  });

  if (!record) {
    const code = locationCode ?? `${warehouseId.replace(/^WH-/, "")}-R-STG-01`;
    const loc = await tx.location.findFirst({ where: { warehouseId, code } });
    record = await tx.inventoryRecord.create({
      data: {
        id: `inv_${warehouseId.replace(/^WH-/, "")}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        warehouseId, productId, locationId: loc?.id ?? "", locationCode: code,
        lot: `L${new Date().toISOString().slice(2, 4)}${String(Math.ceil(new Date().getDate() / 7)).padStart(2, "0")}-${Math.floor(1000 + Math.random() * 8999)}`,
        available: 0, reserved: 0, total: 0, status: "out_of_stock",
      },
    });
  }

  const total = Math.max(0, record.total + delta);
  await tx.inventoryRecord.update({
    where: { id: record.id },
    data: { total, available: Math.max(0, total - record.reserved), updatedAt: new Date() },
  });
  await tx.location.updateMany({
    where: { warehouseId, code: record.locationCode },
    data: { occupied: { increment: total - record.total } },
  });
  // Clamp occupancy at zero if records were out of sync.
  await tx.location.updateMany({ where: { warehouseId, code: record.locationCode, occupied: { lt: 0 } }, data: { occupied: 0 } });

  const sum = await tx.inventoryRecord.aggregate({ where: { warehouseId, productId }, _sum: { total: true } });
  const f = warehouse.stockLevelFactor;
  const status = stockStatus(sum._sum.total ?? 0, Math.round(product.minStock * f), Math.round(product.maxStock * f));
  await tx.inventoryRecord.updateMany({ where: { warehouseId, productId }, data: { status } });
}
