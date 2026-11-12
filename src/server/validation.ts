import { z } from "zod";
import { ROLES } from "@/lib/permissions";
import { CATEGORIES } from "@/types";

/** Request schemas. Every API input is validated here before reaching business logic. */

const id = z.string().trim().min(1).max(64);
const text = (max = 200) => z.string().trim().max(max);
const required = (max = 200) => z.string().trim().min(1, "is required").max(max);
const qty = z.number().int().min(0).max(1_000_000);
const posQty = z.number().int().min(1).max(1_000_000);
const money = z.number().min(0).max(10_000_000);

export const PRIORITY = z.enum(["low", "normal", "high", "urgent"]);
export const ORDER_STATUS = z.enum(["new", "allocated", "picking", "packing", "ready_to_ship", "shipped", "delivered", "cancelled", "on_hold"]);
export const LOCATION_STATUS = z.enum(["active", "blocked", "maintenance", "reserved"]);
export const LOCATION_TYPE = z.enum(["pick-bin", "pallet", "bulk", "cold", "staging", "dock"]);

export const ProductSchema = z.object({
  sku: z.string().trim().regex(/^[A-Z0-9-]{2,40}$/, "use uppercase letters, digits and dashes"),
  name: required(160),
  barcode: z.string().regex(/^\d{8,14}$/, "must be 8–14 digits"),
  category: z.enum(CATEGORIES),
  brand: text(80),
  description: text(1000),
  uom: z.enum(["EA", "BOX", "CS", "PK", "RL", "KG", "L", "PLT"]),
  unitsPerCase: z.number().int().min(1).max(10_000),
  weightKg: z.number().positive().max(5000),
  dimensions: z.object({ length: z.number().positive().max(5000), width: z.number().positive().max(5000), height: z.number().positive().max(5000) }),
  minStock: qty,
  maxStock: qty,
  reorderQty: qty,
  supplierId: id,
  unitCost: money,
  unitPrice: money,
  storage: z.enum(["ambient", "chilled", "hazmat", "high-value"]),
  status: z.enum(["active", "draft", "discontinued"]),
  // Data URLs are accepted up to ~2.7 MB (a 2 MB image). Use object storage in production.
  imageUrl: z.string().max(2_800_000).nullable().optional(),
});

export const SupplierSchema = z.object({
  name: required(160),
  contactName: required(120),
  email: z.string().email(),
  phone: text(40),
  city: text(80),
  country: text(80),
  leadTimeDays: z.number().int().min(0).max(365),
  onTimeRate: z.number().min(0).max(100).default(100),
  qualityScore: z.number().min(0).max(100).default(100),
  openPOs: z.number().int().min(0).default(0),
  spendYtd: money.default(0),
  categories: z.array(z.enum(CATEGORIES)).min(1),
  paymentTerms: text(40),
  status: z.enum(["active", "on_hold", "inactive"]),
});

const Address = z.object({ line1: required(160), city: required(80), state: required(40), postalCode: text(20), country: text(2).default("US") });

export const CustomerSchema = z.object({
  name: required(160),
  type: z.enum(["Retail", "Wholesale", "E-commerce", "Distributor"]),
  contactName: required(120),
  email: z.string().email(),
  phone: text(40),
  address: Address,
  slaTier: z.enum(["Platinum", "Gold", "Standard"]),
  ordersYtd: z.number().int().min(0).default(0),
  revenueYtd: money.default(0),
  onTimeDelivery: z.number().min(0).max(100).default(100),
  status: z.enum(["active", "credit_hold", "inactive"]),
});

export const EmployeeCreate = z.object({
  name: z.string().trim().min(3).max(120).refine((v) => v.split(/\s+/).length >= 2, "enter first and last name"),
  role: z.enum(["Picker", "Packer", "Receiver", "Forklift Operator", "Inventory Controller", "Shift Supervisor", "Warehouse Manager"]),
  shift: z.enum(["Morning", "Afternoon", "Night"]),
  zone: required(40),
  warehouseId: id,
});
export const EmployeeStatus = z.object({ status: z.enum(["on_shift", "on_break", "off_shift", "on_leave"]) });

export const LocationStatusBody = z.object({ ids: z.array(id).min(1).max(5000), status: LOCATION_STATUS });
export const LocationDeleteBody = z.object({ ids: z.array(id).min(1).max(5000) });
export const LocationCreate = z
  .object({
    warehouseId: id,
    zone: z.object({ code: z.string().trim().regex(/^[A-Z0-9]{1,3}$/, "1–3 uppercase letters or digits"), name: required(60), type: LOCATION_TYPE, temperature: text(20).optional() }),
    aisles: z.tuple([z.number().int().min(1).max(99), z.number().int().min(1).max(99)]),
    racks: z.tuple([z.number().int().min(1).max(99), z.number().int().min(1).max(99)]),
    levels: z.array(z.string().regex(/^[A-Z]$/)).min(1).max(12),
    binsPerLevel: z.number().int().min(1).max(20),
    capacity: z.number().int().min(1).max(100_000),
  })
  .refine((v) => v.aisles[0] <= v.aisles[1] && v.racks[0] <= v.racks[1], "Range start must be before range end");

export const WarehouseCreate = z.object({
  id: z.string().trim().regex(/^WH-[A-Z0-9]{2,8}$/, "use the form WH-XXX"),
  name: required(80),
  city: required(80),
  timezone: required(60),
});

export const InboundCreate = z.object({
  warehouseId: id,
  supplierId: id,
  poNumber: required(40),
  carrier: required(80),
  expectedAt: z.string().datetime(),
  priority: PRIORITY,
  lines: z.array(z.object({ productId: id, expected: posQty })).min(1).max(200),
});
export const InboundLineUpdate = z.object({ sku: required(60), received: qty, damaged: qty });

export const OrderCreate = z.object({
  warehouseId: id,
  customerId: id,
  priority: PRIORITY,
  carrier: required(60),
  service: required(60),
  notes: text(1000).optional(),
  lines: z.array(z.object({ productId: id, quantity: posQty })).min(1).max(200),
});
export const OrderPatch = z.object({ priority: PRIORITY });
export const OrderBulk = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance"), ids: z.array(id).min(1).max(1000) }),
  z.object({ action: z.literal("status"), ids: z.array(id).min(1).max(1000), status: z.enum(["on_hold", "cancelled", "shipped", "new"]) }),
]);
export const WaveRelease = z.object({ warehouseId: id });

export const TaskStatus = z.object({ status: z.enum(["in_progress", "paused"]) });
export const TaskAssign = z.object({ employeeId: id });
export const TaskPick = z.object({ lineIndex: z.number().int().min(0).max(500), picked: qty });

export const TransferCreate = z.object({
  warehouseId: id,
  type: z.enum(["internal", "inter-warehouse", "replenishment"]),
  fromLocation: required(60),
  toLocation: required(60),
  productId: id,
  quantity: posQty,
  reason: text(300),
});
export const TransferStatus = z.object({ status: z.enum(["requested", "in_transit", "completed", "cancelled"]) });

export const AdjustmentCreate = z.object({
  warehouseId: id,
  productId: id,
  locationCode: required(60),
  counted: qty,
  reason: z.enum(["Cycle count", "Damaged goods", "Expired", "Found stock", "Shrinkage", "Data correction", "Return to stock"]),
  note: text(500).optional(),
  postNow: z.boolean().optional(),
});
export const AdjustmentReview = z.object({ ids: z.array(id).min(1).max(1000), decision: z.enum(["approved", "rejected"]) });

export const ActivityCreate = z.object({
  warehouseId: id,
  module: z.enum(["Inventory", "Inbound", "Outbound", "Picking", "Transfers", "Adjustments", "Products", "Locations", "Users", "System"]),
  action: required(120),
  entity: required(120),
  details: text(500),
  severity: z.enum(["info", "success", "warning", "critical"]).optional(),
  source: z.enum(["Web", "RF Scanner"]).optional(),
});

export const NotificationsRead = z.object({ ids: z.union([z.array(id).min(1), z.literal("all")]) });

export const SETTING_KEYS = ["organization", "integrations", "notificationPrefs"] as const;
export const SettingBody = z.object({ value: z.record(z.unknown()) });

export const ScheduleCreate = z.object({
  reportId: required(40),
  frequency: required(40),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  recipients: z
    .string()
    .trim()
    .min(3)
    .max(1000)
    .refine((v) => v.split(/[,;\s]+/).filter(Boolean).every((m) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)), "must be valid email addresses"),
});
export const SchedulePatch = z.object({ enabled: z.boolean() });

const password = z.string().min(10, "must be at least 10 characters").max(200);
export const UserCreate = z.object({
  login: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  name: required(120),
  role: z.enum(ROLES),
  warehouseId: id.nullable(),
  password,
});
export const UserPatch = z.object({
  name: required(120).optional(),
  email: z.string().trim().email().optional(),
  role: z.enum(ROLES).optional(),
  warehouseId: id.nullable().optional(),
  active: z.boolean().optional(),
  password: password.optional(),
});
export const ProfilePatch = z.object({
  name: required(120).optional(),
  email: z.string().trim().email().optional(),
  phone: text(40).optional(),
  language: text(40).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: password.optional(),
});
