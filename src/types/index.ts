import type { WarehouseId } from "@/lib/constants";

export type { WarehouseId };

export type ID = string;
export type ISODate = string;

/* ───────────────────────────── Catalog ───────────────────────────── */

export const CATEGORIES = [
  "Electronics",
  "Power Tools",
  "Industrial Supplies",
  "Packaging",
  "Home & Kitchen",
  "Health & Beauty",
  "Food & Beverage",
  "Automotive",
  "Office Supplies",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type UnitOfMeasure = "EA" | "BOX" | "CS" | "PK" | "RL" | "KG" | "L" | "PLT";
export type ProductStatus = "active" | "draft" | "discontinued";
export type StorageCondition = "ambient" | "chilled" | "hazmat" | "high-value";

export interface Dimensions {
  length: number; // cm
  width: number;
  height: number;
}

export interface Product {
  id: ID;
  sku: string;
  name: string;
  barcode: string;
  category: Category;
  brand: string;
  description: string;
  uom: UnitOfMeasure;
  unitsPerCase: number;
  weightKg: number;
  dimensions: Dimensions;
  minStock: number;
  maxStock: number;
  reorderQty: number;
  supplierId: ID;
  unitCost: number;
  unitPrice: number;
  storage: StorageCondition;
  status: ProductStatus;
  imageUrl?: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ───────────────────────────── Locations ───────────────────────────── */

export type LocationType = "pick-bin" | "pallet" | "bulk" | "cold" | "staging" | "dock";
export type LocationStatus = "active" | "blocked" | "maintenance" | "reserved";

export interface Zone {
  id: ID;
  warehouseId: WarehouseId;
  code: string; // "A"
  name: string;
  type: LocationType;
  temperature?: string;
}

export interface Location {
  id: ID;
  code: string; // ATL-A-01-03-B-02
  warehouseId: WarehouseId;
  zone: string;
  aisle: string;
  rack: string;
  shelf: string;
  bin: string;
  type: LocationType;
  capacity: number; // units
  occupied: number; // units
  status: LocationStatus;
  productIds: ID[];
  lastCountedAt: ISODate;
}

/* ───────────────────────────── Inventory ───────────────────────────── */

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "overstock";

export interface InventoryRecord {
  id: ID;
  warehouseId: WarehouseId;
  productId: ID;
  sku: string;
  productName: string;
  category: Category;
  locationId: ID;
  locationCode: string;
  lot: string;
  expiresAt?: ISODate;
  available: number;
  reserved: number;
  total: number;
  status: StockStatus;
  updatedAt: ISODate;
}

/* ───────────────────────────── Partners ───────────────────────────── */

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  leadTimeDays: number;
  onTimeRate: number; // %
  qualityScore: number; // %
  openPOs: number;
  spendYtd: number;
  categories: Category[];
  paymentTerms: string;
  status: "active" | "on_hold" | "inactive";
}

export type CustomerType = "Retail" | "Wholesale" | "E-commerce" | "Distributor";
export type SlaTier = "Platinum" | "Gold" | "Standard";

export interface Address {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: ID;
  code: string;
  name: string;
  type: CustomerType;
  contactName: string;
  email: string;
  phone: string;
  address: Address;
  slaTier: SlaTier;
  ordersYtd: number;
  revenueYtd: number;
  onTimeDelivery: number;
  status: "active" | "credit_hold" | "inactive";
}

/* ───────────────────────────── Inbound ───────────────────────────── */

export const INBOUND_STAGES = ["expected", "arrived", "receiving", "quality_check", "putaway", "completed"] as const;
export type InboundStatus = (typeof INBOUND_STAGES)[number];

export interface InboundLine {
  productId: ID;
  sku: string;
  productName: string;
  expected: number;
  received: number;
  damaged: number;
}

export interface InboundShipment {
  id: ID; // ASN number
  warehouseId: WarehouseId;
  poNumber: string;
  supplierId: ID;
  supplierName: string;
  carrier: string;
  trackingNumber: string;
  dock?: string;
  expectedAt: ISODate;
  arrivedAt?: ISODate;
  completedAt?: ISODate;
  status: InboundStatus;
  priority: Priority;
  pallets: number;
  lines: InboundLine[];
  notes?: string;
}

/* ───────────────────────────── Outbound / Orders ───────────────────────────── */

export type Priority = "low" | "normal" | "high" | "urgent";

export const ORDER_STAGES = ["new", "allocated", "picking", "packing", "ready_to_ship", "shipped"] as const;
export type OrderStatus = (typeof ORDER_STAGES)[number] | "delivered" | "cancelled" | "on_hold";

export type SalesChannel = "EDI" | "B2B Portal" | "Shopify" | "Marketplace" | "Manual";

export interface OrderLine {
  productId: ID;
  sku: string;
  productName: string;
  locationCode: string;
  quantity: number;
  picked: number;
  packed: number;
  unitPrice: number;
}

export interface Order {
  id: ID; // SO-xxxxx
  warehouseId: WarehouseId;
  customerId: ID;
  customerName: string;
  channel: SalesChannel;
  createdAt: ISODate;
  requestedShipAt: ISODate;
  shippedAt?: ISODate;
  priority: Priority;
  status: OrderStatus;
  shippingAddress: Address;
  carrier: string;
  service: string;
  trackingNumber?: string;
  lines: OrderLine[];
  weightKg: number;
  cartons: number;
  notes?: string;
}

/* ───────────────────────────── Tasks ───────────────────────────── */

export type TaskStatus = "queued" | "in_progress" | "paused" | "completed";

export interface PickLine {
  sku: string;
  productName: string;
  locationCode: string;
  quantity: number;
  picked: number;
  uom: UnitOfMeasure;
}

export interface PickTask {
  id: ID;
  warehouseId: WarehouseId;
  orderId: ID;
  customerName: string;
  type: "single" | "batch" | "wave";
  zone: string;
  assigneeId?: ID;
  assigneeName?: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: ISODate;
  startedAt?: ISODate;
  dueAt: ISODate;
  cart?: string;
  lines: PickLine[];
}

export type TransferStatus = "draft" | "requested" | "in_transit" | "completed" | "cancelled";

export interface TransferLine {
  productId: ID;
  sku: string;
  productName: string;
  quantity: number;
}

export interface StockTransfer {
  id: ID;
  warehouseId: WarehouseId;
  type: "internal" | "inter-warehouse" | "replenishment";
  fromLocation: string;
  toLocation: string;
  lines: TransferLine[];
  status: TransferStatus;
  requestedBy: string;
  assignedTo?: string;
  createdAt: ISODate;
  completedAt?: ISODate;
  reason: string;
}

export type AdjustmentReason =
  | "Cycle count"
  | "Damaged goods"
  | "Expired"
  | "Found stock"
  | "Shrinkage"
  | "Data correction"
  | "Return to stock";

export interface StockAdjustment {
  id: ID;
  warehouseId: WarehouseId;
  productId: ID;
  sku: string;
  productName: string;
  locationCode: string;
  before: number;
  after: number;
  reason: AdjustmentReason;
  note?: string;
  requestedBy: string;
  approvedBy?: string;
  createdAt: ISODate;
  status: "pending" | "approved" | "rejected";
  valueImpact: number;
}

/* ───────────────────────────── People ───────────────────────────── */

export type EmployeeRole =
  | "Picker"
  | "Packer"
  | "Receiver"
  | "Forklift Operator"
  | "Inventory Controller"
  | "Shift Supervisor"
  | "Warehouse Manager";

export interface Employee {
  id: ID;
  badge: string;
  name: string;
  email: string;
  role: EmployeeRole;
  warehouseId: WarehouseId;
  shift: "Morning" | "Afternoon" | "Night";
  zone: string;
  status: "on_shift" | "on_break" | "off_shift" | "on_leave";
  unitsPerHour: number;
  accuracy: number;
  tasksToday: number;
  certifications: string[];
  device?: string;
  hiredAt: ISODate;
}

/* ───────────────────────────── System ───────────────────────────── */

export type LogModule =
  | "Inventory"
  | "Inbound"
  | "Outbound"
  | "Picking"
  | "Transfers"
  | "Adjustments"
  | "Products"
  | "Locations"
  | "Users"
  | "System";

export interface ActivityEvent {
  id: ID;
  warehouseId: WarehouseId;
  timestamp: ISODate;
  actor: string;
  actorRole: string;
  module: LogModule;
  action: string;
  entity: string;
  details: string;
  severity: "info" | "success" | "warning" | "critical";
  source: "Web" | "RF Scanner" | "API" | "System";
}

export interface AppNotification {
  id: ID;
  title: string;
  body: string;
  timestamp: ISODate;
  kind: "alert" | "inbound" | "outbound" | "system" | "task";
  read: boolean;
  href: string;
}

export interface DailyMetric {
  date: ISODate; // YYYY-MM-DD
  inbound: number; // units received
  outbound: number; // units shipped
  adjustments: number;
  stockOnHand: number;
  ordersReceived: number;
  ordersShipped: number;
  onTimeRate: number;
  pickRate: number; // units / labor hour
  avgPickMinutes: number;
  accuracy: number;
  utilization: number;
}
