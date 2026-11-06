import type { BadgeTone } from "@/components/ui/badge";
import type {
  InboundStatus,
  LocationStatus,
  OrderStatus,
  Priority,
  ProductStatus,
  StockStatus,
  TaskStatus,
  TransferStatus,
  Employee,
  StockAdjustment,
  ActivityEvent,
} from "@/types";

type Meta = { label: string; tone: BadgeTone };

export const STOCK_STATUS: Record<StockStatus, Meta> = {
  in_stock: { label: "In stock", tone: "success" },
  low_stock: { label: "Low stock", tone: "warning" },
  out_of_stock: { label: "Out of stock", tone: "danger" },
  overstock: { label: "Overstock", tone: "violet" },
};

export const INBOUND_STATUS: Record<InboundStatus, Meta> = {
  expected: { label: "Expected", tone: "neutral" },
  arrived: { label: "Arrived", tone: "cyan" },
  receiving: { label: "Receiving", tone: "primary" },
  quality_check: { label: "Quality check", tone: "warning" },
  putaway: { label: "Putaway", tone: "violet" },
  completed: { label: "Completed", tone: "success" },
};

export const ORDER_STATUS: Record<OrderStatus, Meta> = {
  new: { label: "New", tone: "neutral" },
  allocated: { label: "Allocated", tone: "cyan" },
  picking: { label: "Picking", tone: "primary" },
  packing: { label: "Packing", tone: "violet" },
  ready_to_ship: { label: "Ready to ship", tone: "warning" },
  shipped: { label: "Shipped", tone: "success" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  on_hold: { label: "On hold", tone: "danger" },
};

export const PRIORITY: Record<Priority, Meta & { rank: number }> = {
  urgent: { label: "Urgent", tone: "danger", rank: 4 },
  high: { label: "High", tone: "warning", rank: 3 },
  normal: { label: "Normal", tone: "neutral", rank: 2 },
  low: { label: "Low", tone: "neutral", rank: 1 },
};

export const TASK_STATUS: Record<TaskStatus, Meta> = {
  queued: { label: "Queued", tone: "neutral" },
  in_progress: { label: "In progress", tone: "primary" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
};

export const TRANSFER_STATUS: Record<TransferStatus, Meta> = {
  draft: { label: "Draft", tone: "neutral" },
  requested: { label: "Requested", tone: "cyan" },
  in_transit: { label: "In transit", tone: "primary" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const LOCATION_STATUS: Record<LocationStatus, Meta> = {
  active: { label: "Active", tone: "success" },
  blocked: { label: "Blocked", tone: "danger" },
  maintenance: { label: "Maintenance", tone: "warning" },
  reserved: { label: "Reserved", tone: "primary" },
};

export const PRODUCT_STATUS: Record<ProductStatus, Meta> = {
  active: { label: "Active", tone: "success" },
  draft: { label: "Draft", tone: "neutral" },
  discontinued: { label: "Discontinued", tone: "danger" },
};

export const EMPLOYEE_STATUS: Record<Employee["status"], Meta> = {
  on_shift: { label: "On shift", tone: "success" },
  on_break: { label: "On break", tone: "warning" },
  off_shift: { label: "Off shift", tone: "neutral" },
  on_leave: { label: "On leave", tone: "violet" },
};

export const ADJUSTMENT_STATUS: Record<StockAdjustment["status"], Meta> = {
  pending: { label: "Pending approval", tone: "warning" },
  approved: { label: "Posted", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const SEVERITY: Record<ActivityEvent["severity"], Meta> = {
  info: { label: "Info", tone: "neutral" },
  success: { label: "Success", tone: "success" },
  warning: { label: "Warning", tone: "warning" },
  critical: { label: "Critical", tone: "danger" },
};

export const LOCATION_TYPE_LABEL: Record<string, string> = {
  "pick-bin": "Pick bin",
  pallet: "Pallet rack",
  bulk: "Bulk lane",
  cold: "Cold rack",
  staging: "Staging lane",
  dock: "Dock door",
};
