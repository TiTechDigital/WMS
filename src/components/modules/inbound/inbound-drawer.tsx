"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Printer } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Stepper } from "@/components/shared/stage-flow";
import { StatusBadge } from "@/components/shared/status-badge";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { useWms } from "@/store/wms-store";
import { INBOUND_STATUS, PRIORITY } from "@/lib/status";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { INBOUND_STAGES } from "@/types";
import { NEXT_ACTION, shipmentTotals } from "./inbound-shared";
import { cn } from "@/lib/utils";

export function InboundDrawer({ id, onOpenChange }: { id: string | null; onOpenChange: (v: boolean) => void }) {
  const { inbound, suppliers, actions } = useWms();
  const s = inbound.find((x) => x.id === id);
  const supplier = suppliers.find((x) => x.id === s?.supplierId);
  const editable = s && (s.status === "arrived" || s.status === "receiving");

  const advance = () => {
    if (!s) return;
    const next = actions.advanceInbound(s.id);
    if (next) toast.success(`${s.id} → ${INBOUND_STATUS[next].label}`, { description: next === "completed" ? "Stock posted to inventory" : undefined });
  };

  return (
    <Sheet open={!!s} onOpenChange={onOpenChange}>
      <SheetContent width="xl">
        {s && (() => {
          const t = shipmentTotals(s);
          return (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="font-mono">{s.id}</SheetTitle>
                  <StatusBadge map={INBOUND_STATUS} value={s.status} />
                  <Badge tone={PRIORITY[s.priority].tone}>{PRIORITY[s.priority].label}</Badge>
                </div>
                <SheetDescription>
                  {s.poNumber} · {s.supplierName}
                </SheetDescription>
                <Stepper className="mt-4" steps={INBOUND_STAGES.map((k) => ({ key: k, label: INBOUND_STATUS[k].label }))} current={s.status === "completed" ? "__done" : s.status} />
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["Expected", formatNumber(t.expected)],
                    ["Received", formatNumber(t.received)],
                    ["Damaged", formatNumber(t.damaged)],
                    ["Variance", t.counted ? (t.variance > 0 ? `+${t.variance}` : String(t.variance)) : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className={cn("rounded-md border bg-subtle px-3 py-2", k === "Variance" && t.variance < 0 && "border-danger/30 bg-danger-soft", k === "Damaged" && t.damaged > 0 && "border-warning/40 bg-warning-soft")}>
                      <div className="text-2xs text-muted-foreground">{k}</div>
                      <div className="text-base font-semibold tabular">{v}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <SectionTitle>Shipment</SectionTitle>
                  <DescriptionList
                    columns={3}
                    items={[
                      ["Expected", formatDateTime(s.expectedAt)],
                      ["Arrived", s.arrivedAt ? formatDateTime(s.arrivedAt) : "—"],
                      ["Dock", s.dock ?? "Unassigned"],
                      ["Carrier", s.carrier],
                      ["Tracking / PRO", <span key="t" className="font-mono text-xs">{s.trackingNumber}</span>],
                      ["Pallets", s.pallets],
                    ]}
                  />
                  {s.notes && <div className="mt-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs">{s.notes}</div>}
                </div>

                <div>
                  <SectionTitle>Supplier</SectionTitle>
                  <DescriptionList
                    columns={3}
                    items={[
                      ["Name", s.supplierName],
                      ["Contact", supplier?.contactName ?? "—"],
                      ["Phone", supplier?.phone ?? "—"],
                      ["On-time rate", supplier ? `${supplier.onTimeRate}%` : "—"],
                      ["Quality score", supplier ? `${supplier.qualityScore}%` : "—"],
                      ["Origin", supplier ? `${supplier.city}, ${supplier.country}` : "—"],
                    ]}
                  />
                </div>

                <div>
                  <SectionTitle action={editable ? <span className="text-2xs text-primary">Enter counted quantities</span> : undefined}>Lines ({s.lines.length})</SectionTitle>
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-[13px]">
                      <thead className="bg-subtle text-2xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">SKU</th>
                          <th className="px-3 py-2 text-right font-semibold">Expected</th>
                          <th className="px-3 py-2 text-right font-semibold">Received</th>
                          <th className="px-3 py-2 text-right font-semibold">Damaged</th>
                          <th className="px-3 py-2 text-right font-semibold">Diff.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.lines.map((l) => {
                          const diff = l.received - l.expected;
                          return (
                            <tr key={l.sku} className="border-t">
                              <td className="px-3 py-2">
                                <div className="font-mono text-xs">{l.sku}</div>
                                <div className="max-w-[260px] truncate text-2xs text-muted-foreground">{l.productName}</div>
                              </td>
                              <td className="px-3 py-2 text-right tabular">{formatNumber(l.expected)}</td>
                              <td className="px-3 py-2 text-right">
                                {editable ? (
                                  <Input type="number" min={0} className="ml-auto h-7 w-20 text-right" value={l.received} onChange={(e) => actions.updateInboundLine(s.id, l.sku, Math.max(0, Number(e.target.value)), l.damaged)} aria-label={`Received ${l.sku}`} />
                                ) : (
                                  <span className="tabular">{formatNumber(l.received)}</span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {editable ? (
                                  <Input type="number" min={0} className="ml-auto h-7 w-16 text-right" value={l.damaged} onChange={(e) => actions.updateInboundLine(s.id, l.sku, l.received, Math.max(0, Number(e.target.value)))} aria-label={`Damaged ${l.sku}`} />
                                ) : (
                                  <span className={cn("tabular", l.damaged > 0 && "text-[hsl(32_95%_38%)]")}>{l.damaged}</span>
                                )}
                              </td>
                              <td className={cn("px-3 py-2 text-right font-medium tabular", l.received === 0 ? "text-muted-foreground" : diff < 0 ? "text-danger" : diff > 0 ? "text-[hsl(32_95%_38%)]" : "text-success")}>
                                {l.received === 0 ? "—" : diff === 0 ? "✓" : diff > 0 ? `+${diff}` : diff}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SheetBody>
              <SheetFooter className="justify-between">
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      actions.log({ module: "Inbound", action: "Labels printed", entity: s.id, details: `${s.pallets} LPN labels → ZB-RECV-01`, severity: "info" });
                      toast.success(`${s.pallets} pallet labels sent to ZB-RECV-01`);
                    }}
                  >
                    <Printer /> Print LPNs
                  </Button>
                  {t.counted && t.variance !== 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        actions.log({ module: "Inbound", action: "Discrepancy reported", entity: s.id, details: `${t.variance} units vs ${s.poNumber} — ${s.supplierName} notified`, severity: "warning" });
                        toast.success("Discrepancy report sent", { description: `${s.supplierName} notified of ${t.variance} unit variance` });
                      }}
                    >
                      <AlertTriangle /> Report discrepancy
                    </Button>
                  )}
                </div>
                {NEXT_ACTION[s.status] ? (
                  <Button onClick={advance}>
                    {NEXT_ACTION[s.status]} <ArrowRight />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">Completed {s.completedAt ? formatRelative(s.completedAt) : ""}</span>
                )}
              </SheetFooter>
            </>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}
