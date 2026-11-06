/**
 * Mock dataset entry point.
 *
 * Everything here is generated deterministically from seeded PRNGs, so the same data is
 * produced on the server and in the browser. When a backend is introduced, replace the
 * `seed` consumers in `src/store/wms-store.tsx` with calls to `src/services/*`.
 */
import { generateCustomers, generateSuppliers, supplierIdsByBrand, supplierIdsByCategory } from "./partners";
import { generateProducts } from "./catalog";
import { generateEmployees } from "./people";
import { generateWarehouseStock, generateZones } from "./warehouse";
import { generateAdjustments, generateInbound, generateOrders, generatePickTasks, generateTransfers } from "./operations";
import { generateActivity, generateMetrics, generateNotifications } from "./activity";

function buildSeed() {
  const suppliers = generateSuppliers();
  const customers = generateCustomers();
  const products = generateProducts(supplierIdsByCategory(suppliers), supplierIdsByBrand(suppliers));
  const employees = generateEmployees();
  const zones = generateZones();
  const { locations, inventory } = generateWarehouseStock(products);
  const inbound = generateInbound(products, suppliers, inventory);
  const orders = generateOrders(products, customers, inventory);
  const pickTasks = generatePickTasks(orders, employees, products);
  const transfers = generateTransfers(inventory, employees);
  const adjustments = generateAdjustments(inventory, products, employees);
  const activity = generateActivity({ employees, inbound, orders, transfers, adjustments, inventory });
  const metrics = generateMetrics();
  const notifications = generateNotifications();
  return { suppliers, customers, products, employees, zones, locations, inventory, inbound, orders, pickTasks, transfers, adjustments, activity, metrics, notifications };
}

export type Seed = ReturnType<typeof buildSeed>;

let cached: Seed | null = null;
export function getSeed(): Seed {
  if (!cached) cached = buildSeed();
  return cached;
}
