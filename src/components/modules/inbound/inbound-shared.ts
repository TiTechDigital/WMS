import type { InboundShipment, InboundStatus } from "@/types";

export const NEXT_ACTION: Partial<Record<InboundStatus, string>> = {
  expected: "Check in",
  arrived: "Start receiving",
  receiving: "Send to QC",
  quality_check: "Approve QC",
  putaway: "Confirm putaway",
};

export function shipmentTotals(s: InboundShipment) {
  const expected = s.lines.reduce((a, l) => a + l.expected, 0);
  const received = s.lines.reduce((a, l) => a + l.received, 0);
  const damaged = s.lines.reduce((a, l) => a + l.damaged, 0);
  const counted = ["quality_check", "putaway", "completed"].includes(s.status);
  const variance = counted ? received - expected : 0;
  return { expected, received, damaged, variance, counted };
}
