"use client";

import * as React from "react";
import { Box, Check, Printer, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { useWms } from "@/store/wms-store";
import { PRIORITY } from "@/lib/status";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const CARTONS = [
  { code: "S", label: "Small 30×20×15", maxKg: 5 },
  { code: "M", label: "Medium 40×30×30", maxKg: 15 },
  { code: "L", label: "Large 60×40×40", maxKg: 25 },
  { code: "PLT", label: "Pallet 120×100", maxKg: 900 },
];

export function PackStation() {
  const { orders, actions } = useWms();
  const queue = orders.filter((o) => o.status === "packing").sort((a, b) => PRIORITY[b.priority].rank - PRIORITY[a.priority].rank || a.requestedShipAt.localeCompare(b.requestedShipAt));
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const order = queue.find((o) => o.id === selectedId) ?? queue[0];
  const [checked, setChecked] = React.useState<Set<number>>(new Set());
  const [carton, setCarton] = React.useState("M");

  React.useEffect(() => {
    setChecked(new Set());
    if (order) setCarton(order.weightKg > 200 ? "PLT" : order.weightKg > 15 ? "L" : order.weightKg > 5 ? "M" : "S");
  }, [order?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const all = order ? checked.size === order.lines.length : false;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <div className="overflow-hidden rounded-lg border bg-surface shadow-card">
        <div className="border-b px-4 py-3 text-[13px] font-semibold">
          Pack queue <span className="ml-1 font-normal text-muted-foreground">{queue.length}</span>
        </div>
        <div className="scrollbar-thin max-h-[640px] overflow-y-auto">
          {queue.map((o) => (
            <button key={o.id} onClick={() => setSelectedId(o.id)} className={cn("flex w-full items-center gap-3 border-b px-4 py-2.5 text-left last:border-0 hover:bg-subtle", order?.id === o.id && "bg-primary-soft/60")}>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs font-medium">{o.id}</div>
                <div className="truncate text-2xs text-muted-foreground">{o.customerName}</div>
              </div>
              <div className="text-right">
                <Badge tone={PRIORITY[o.priority].tone}>{PRIORITY[o.priority].label}</Badge>
                <div className="mt-0.5 text-2xs text-muted-foreground">{o.lines.length} lines</div>
              </div>
            </button>
          ))}
          {queue.length === 0 && <EmptyState icon={Box} title="Pack queue is empty" description="Completed pick tasks will appear here." />}
        </div>
      </div>

      {order ? (
        <div className="rounded-lg border bg-surface shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-semibold">{order.id}</span>
                <Badge tone={PRIORITY[order.priority].tone}>{PRIORITY[order.priority].label}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {order.customerName} · {order.carrier} {order.service} · ship {formatRelative(order.requestedShipAt)}
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <Scale className="size-3.5 text-muted-foreground" /> <span className="font-medium tabular">{order.weightKg} kg</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Box className="size-3.5 text-muted-foreground" /> <span className="font-medium tabular">{order.cartons} ctn</span>
              </span>
            </div>
          </div>
          <div className="grid gap-6 p-5 xl:grid-cols-[1fr_260px]">
            <div>
              <div className="mb-2 flex items-center justify-between text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verify items
                <button className="normal-case tracking-normal text-primary hover:underline" onClick={() => setChecked(all ? new Set() : new Set(order.lines.map((_, i) => i)))}>
                  {all ? "Clear all" : "Check all"}
                </button>
              </div>
              <div className="divide-y rounded-md border">
                {order.lines.map((l, i) => (
                  <label key={l.sku + i} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-subtle">
                    <Checkbox
                      checked={checked.has(i)}
                      onCheckedChange={(v) =>
                        setChecked((s) => {
                          const n = new Set(s);
                          if (v) n.add(i);
                          else n.delete(i);
                          return n;
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[13px]", checked.has(i) && "text-muted-foreground line-through")}>{l.productName}</span>
                      <span className="font-mono text-2xs text-muted-foreground">{l.sku}</span>
                    </span>
                    <span className="text-[13px] font-semibold tabular">× {l.quantity}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Carton</div>
                <div className="grid grid-cols-2 gap-2">
                  {CARTONS.map((c) => (
                    <button key={c.code} onClick={() => setCarton(c.code)} className={cn("rounded-md border px-2.5 py-2 text-left transition-colors", carton === c.code ? "border-primary bg-primary-soft" : "hover:bg-accent")}>
                      <div className={cn("text-[13px] font-semibold", carton === c.code && "text-primary")}>{c.code}</div>
                      <div className="text-2xs text-muted-foreground">{c.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                size="xl"
                className="w-full"
                disabled={!all}
                onClick={() => {
                  actions.setOrderStatus(order.id, "ready_to_ship");
                  actions.log({ module: "Outbound", action: "Shipping label printed", entity: order.id, details: `${order.carrier} ${order.service} · carton ${carton}`, severity: "info" });
                  toast.success(`${order.id} packed`, { description: `Label printed · moved to Ready to ship` });
                  setSelectedId(null);
                }}
              >
                <Printer /> Print label & close
              </Button>
              {!all && <p className="text-center text-2xs text-muted-foreground">Verify all {order.lines.length} lines to continue</p>}
              {all && (
                <p className="flex items-center justify-center gap-1 text-2xs text-success">
                  <Check className="size-3" /> All items verified
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-surface shadow-card">
          <EmptyState icon={Box} title="Nothing to pack" description="When pickers complete tasks, orders arrive here for verification and labelling." />
        </div>
      )}
    </div>
  );
}
