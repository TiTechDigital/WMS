/**
 * Reference "now" for the mock dataset. All sample timestamps are generated relative
 * to this instant so that server and client renders are identical. When a real API is
 * connected, replace usages with `new Date()`.
 */
export const REFERENCE_NOW = new Date("2026-11-06T14:30:00Z");

export const WAREHOUSES = [
  { id: "WH-ATL", name: "Atlanta DC", city: "Atlanta, GA" },
  { id: "WH-DAL", name: "Dallas Fulfillment", city: "Dallas, TX" },
  { id: "WH-RNO", name: "Reno West Hub", city: "Reno, NV" },
] as const;

export type WarehouseId = (typeof WAREHOUSES)[number]["id"];
