/** Current time. Centralised so tests and the seed script can reason about "now" in one place. */
export function currentTime() {
  return new Date();
}

/**
 * Sites created by the seed script. At runtime the list of warehouses comes from the
 * database (`useWms().warehouses`); this constant is only used to generate demo data.
 */
export const WAREHOUSES = [
  { id: "WH-ATL", name: "Atlanta DC", city: "Atlanta, GA" },
  { id: "WH-DAL", name: "Dallas Fulfillment", city: "Dallas, TX" },
  { id: "WH-RNO", name: "Reno West Hub", city: "Reno, NV" },
] as const;

/** Warehouse identifiers are database keys (e.g. "WH-ATL"). */
export type WarehouseId = string;
