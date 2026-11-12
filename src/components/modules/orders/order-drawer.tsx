"use client";

import * as React from "react";
import { ArrowRight, Ban, ChevronDown, Copy, PauseCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Stepper } from "@/components/shared/stage-flow";
import { StatusBadge } from "@/components/shared/status-badge";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { useWms } from "@/store/wms-store";
import { ORDER_STATUS, PRIORITY } from "@/lib/status";
import { formatCurrency, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { ORDER_STAGES, type Priority } from "@/types";
import { ORDER_NEXT_ACTION, orderTotals } from "./order-shared";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/shared/confirm-dialog";

export function OrderDrawer({ id, onOpenChange }: { id: string | null; onOpenChange: (v: boolean) => void }) {
  const { orders, customers, pickTasks, actions, can } = useWms();
  const o = orders.find((x) => x.id === id);
  const customer = customers.find((c) => c.id === o?.customerId);
  const task = pickTasks.find((t) => t.orderId === id);
  const { confirm, dialog } = useConfirm();

  const canManage = can("orders.manage");
  const [busy, setBusy] = React.useState(false);
  const advance = async () => {
    if (!o) return;
    setBusy(true);
    const next = await actions.advanceOrder(o.id);
    setBusy(false);
    if (next) toast.success(`${o.id} → ${ORDER_STATUS[next].label}`);
  };

  return (
    <Sheet open={!!o} onOpenChange={onOpenChange}>
      <SheetContent width="xl">
        {o && (() => {
          const t = orderTotals(o);
          const closed = ["shipped", "delivered", "cancelled"].includes(o.status);
          const stepCurrent = o.status === "delivered" ? "__done" : o.status === "on_hold" || o.status === "cancelled" ? "new" : o.status;
          return (
            <>
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle className="font-mono">{o.id}</SheetTitle>
                  <StatusBadge map={ORDER_STATUS} value={o.status} />
                  <Badge tone={PRIORITY[o.priority].tone}>{PRIORITY[o.priority].label} priority</Badge>
                  <Badge>{o.channel}</Badge>
                </div>
                <SheetDescription>
                  {o.customerName} · placed {formatDateTime(o.createdAt)} ({formatRelative(o.createdAt)})
                </SheetDescription>
                <Stepper className="mt-4" steps={ORDER_STAGES.map((k) => ({ key: k, label: ORDER_STATUS[k].label }))} current={stepCurrent} />
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-4 gap-2">
                  {[
                    ["Units", formatNumber(t.qty)],
                    ["Picked", `${formatNumber(t.picked)}`],
                    ["Packed", `${formatNumber(t.packed)}`],
                    ["Order value", formatCurrency(t.value)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border bg-subtle px-3 py-2">
                      <div className="text-2xs text-muted-foreground">{k}</div>
                      <div className="text-base font-semibold tabular">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <SectionTitle>Ship to</SectionTitle>
                    <div className="text-[13px] leading-relaxed">
                      <div className="font-medium">{o.customerName}</div>
                      <div className="text-muted-foreground">{o.shippingAddress.line1}</div>
                      <div className="text-muted-foreground">
                        {o.shippingAddress.city}, {o.shippingAddress.state} {o.shippingAddress.postalCode}
                      </div>
                      {customer && <div className="mt-1 text-xs text-muted-foreground">{customer.contactName} · {customer.phone}</div>}
                    </div>
                  </div>
                  <div>
                    <SectionTitle>Shipping</SectionTitle>
                    <DescriptionList
                      items={[
                        ["Carrier", `${o.carrier} ${o.service}`],
                        ["Ship by", formatDateTime(o.requestedShipAt)],
                        ["Tracking", o.trackingNumber ? <span key="t" className="font-mono text-xs">{o.trackingNumber}</span> : "—"],
                        ["Weight / cartons", `${o.weightKg} kg · ${o.cartons}`],
                      ]}
                    />
                  </div>
                </div>
                {o.notes && <div className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-xs">{o.notes}</div>}
                <div>
                  <SectionTitle action={task ? <span className="font-mono text-2xs text-muted-foreground">{task.id} · {task.assigneeName ?? "Unassigned"}</span> : undefined}>Lines ({o.lines.length})</SectionTitle>
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-[13px]">
                      <thead className="bg-subtle text-xs text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left font-medium">Product</th>
                          <th scope="col" className="px-3 py-2 text-left font-medium">Location</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Picked</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Packed</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.lines.map((l) => (
                          <tr key={l.sku + l.locationCode} className="border-t">
                            <td className="px-3 py-2">
                              <div className="max-w-[220px] truncate">{l.productName}</div>
                              <div className="font-mono text-2xs text-muted-foreground">{l.sku}</div>
                            </td>
                            <td className="px-3 py-2 font-mono text-2xs">{l.locationCode}</td>
                            <td className="px-3 py-2 text-right tabular">{l.quantity}</td>
                            <td className={cn("px-3 py-2 text-right tabular", l.picked === l.quantity ? "text-success-text" : "text-muted-foreground")}>{l.picked}</td>
                            <td className={cn("px-3 py-2 text-right tabular", l.packed === l.quantity ? "text-success-text" : "text-muted-foreground")}>{l.packed}</td>
                            <td className="px-3 py-2 text-right tabular">{formatCurrency(l.quantity * l.unitPrice, true)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t bg-subtle text-xs">
                        <tr>
                          <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Total</td>
                          <td className="px-3 py-2 text-right font-semibold tabular">{formatCurrency(t.value, true)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </SheetBody>
              <SheetFooter className="justify-between">
                <div className="flex gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost">
                        More <ChevronDown />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-52">
                      <DropdownMenuLabel>Priority</DropdownMenuLabel>
                      <DropdownMenuRadioGroup
                        value={o.priority}
                        onValueChange={async (v) => {
                          if (await actions.setOrderPriority(o.id, v as Priority)) toast.success(`Priority set to ${PRIORITY[v as Priority].label}`);
                        }}
                      >
                        {(["urgent", "high", "normal", "low"] as Priority[]).map((p) => (
                          <DropdownMenuRadioItem key={p} value={p} disabled={closed || !canManage}>
                            {PRIORITY[p].label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          actions.log({ module: "Outbound", action: "Packing slip printed", entity: o.id, details: "Sent to ZB-PACK-02", severity: "info" });
                          toast.success("Packing slip sent to ZB-PACK-02");
                        }}
                      >
                        <Printer /> Print packing slip
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          navigator.clipboard?.writeText(o.id).catch(() => undefined);
                          toast.success(`${o.id} copied to clipboard`);
                        }}
                      >
                        <Copy /> Copy order ID
                      </DropdownMenuItem>
                      {canManage && !closed && o.status !== "on_hold" && (
                        <DropdownMenuItem
                          onSelect={async () => {
                            if (await actions.setOrderStatus(o.id, "on_hold")) toast.warning(`${o.id} placed on hold`);
                          }}
                        >
                          <PauseCircle /> Place on hold
                        </DropdownMenuItem>
                      )}
                      {canManage && !closed && (
                        <DropdownMenuItem
                          destructive
                          onSelect={() =>
                            confirm({
                              title: `Cancel ${o.id}?`,
                              description: `${o.customerName} · ${o.lines.length} lines. Reserved stock is released and open pick tasks stop. Cancelled orders can't be reopened.`,
                              confirmLabel: "Cancel order",
                              tone: "danger",
                              onConfirm: async () => {
                                if (await actions.setOrderStatus(o.id, "cancelled")) toast.error(`${o.id} cancelled`);
                              },
                            })
                          }
                        >
                          <Ban /> Cancel order
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {ORDER_NEXT_ACTION[o.status] && canManage ? (
                  <Button onClick={advance} disabled={busy}>
                    {ORDER_NEXT_ACTION[o.status]} <ArrowRight />
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{o.shippedAt ? `Shipped ${formatRelative(o.shippedAt)}` : ORDER_STATUS[o.status].label}</span>
                )}
              </SheetFooter>
            </>
          );
        })()}
      </SheetContent>
      {dialog}
    </Sheet>
  );
}
