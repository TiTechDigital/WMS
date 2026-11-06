import type { Order, OrderStatus } from "@/types";

export const ORDER_NEXT_ACTION: Partial<Record<OrderStatus, string>> = {
  on_hold: "Release hold",
  new: "Allocate",
  allocated: "Start picking",
  picking: "Complete pick",
  packing: "Mark packed",
  ready_to_ship: "Ship",
};

export function orderTotals(o: Order) {
  const qty = o.lines.reduce((a, l) => a + l.quantity, 0);
  const picked = o.lines.reduce((a, l) => a + l.picked, 0);
  const packed = o.lines.reduce((a, l) => a + l.packed, 0);
  const value = o.lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);
  return { qty, picked, packed, value };
}

export const OPEN_STATUSES: OrderStatus[] = ["new", "allocated", "picking", "packing", "ready_to_ship", "on_hold"];
