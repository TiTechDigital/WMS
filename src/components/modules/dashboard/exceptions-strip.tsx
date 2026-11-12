"use client";

import * as React from "react";
import Link from "next/link";
import { AlertOctagon, Ban, CheckCircle2, Clock, PackageX, SlidersHorizontal, Truck } from "lucide-react";
import { useWms } from "@/store/wms-store";
import { currentTime } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  label: string;
  detail: string;
  count: number;
  href: string;
  severity: "critical" | "warning";
  icon: React.ElementType;
};

/**
 * Exceptions first: the things a shift supervisor must act on now, each linking to the
 * filtered queue where it can be resolved. Severity uses icon + text, not color alone.
 */
export function ExceptionsStrip() {
  const { orders, inbound, inventory, adjustments, locations } = useWms();
  const now = currentTime().toISOString();

  const items = React.useMemo<Item[]>(() => {
    const open = orders.filter((o) => ["new", "allocated", "picking", "packing", "ready_to_ship"].includes(o.status));
    const late = open.filter((o) => o.requestedShipAt < now);
    const urgentNotStarted = open.filter((o) => o.priority === "urgent" && (o.status === "new" || o.status === "allocated"));
    const overdueAsn = inbound.filter((s) => s.status === "expected" && s.expectedAt < now);
    const stockOuts = new Set(inventory.filter((r) => r.status === "out_of_stock").map((r) => r.productId));
    const pending = adjustments.filter((a) => a.status === "pending");
    const blocked = locations.filter((l) => l.status === "blocked" || l.status === "maintenance");
    return [
      { key: "late", label: "Late orders", detail: "Past ship-by date", count: late.length, href: "/outbound", severity: "critical", icon: Clock },
      { key: "urgent", label: "Urgent not started", detail: "Not yet picking", count: urgentNotStarted.length, href: "/outbound?priority=urgent", severity: "critical", icon: Truck },
      { key: "stockout", label: "SKUs out of stock", detail: "Zero on hand", count: stockOuts.size, href: "/inventory?status=out_of_stock", severity: "critical", icon: PackageX },
      { key: "asn", label: "Overdue inbound", detail: "ETA passed", count: overdueAsn.length, href: "/inbound", severity: "warning", icon: AlertOctagon },
      { key: "adj", label: "To approve", detail: "Stock adjustments", count: pending.length, href: "/adjustments", severity: "warning", icon: SlidersHorizontal },
      { key: "loc", label: "Locations down", detail: "Blocked or maintenance", count: blocked.length, href: "/locations", severity: "warning", icon: Ban },
    ];
  }, [orders, inbound, inventory, adjustments, locations, now]);

  const total = items.reduce((s, i) => s + i.count, 0);

  return (
    <section aria-labelledby="exceptions-heading" className="overflow-hidden rounded-lg border bg-surface shadow-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <h2 id="exceptions-heading" className="text-[13px] font-semibold">
          Needs attention
        </h2>
        <span className="text-xs text-muted-foreground">
          {total === 0 ? "All clear for this shift" : `${total} open exception${total === 1 ? "" : "s"}`}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 xl:grid-cols-6">
        {items.map((i) => {
          const clear = i.count === 0;
          const Icon = clear ? CheckCircle2 : i.icon;
          return (
            <li key={i.key} className="bg-surface">
              <Link
                href={i.href}
                className="group flex h-full items-start gap-3 px-4 py-3 transition-colors hover:bg-subtle focus-visible:outline-offset-[-2px]"
                aria-label={`${i.label}: ${i.count}${clear ? "" : i.severity === "critical" ? ", critical" : ", needs review"}. Open queue.`}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md",
                    clear ? "bg-success-soft text-success-text" : i.severity === "critical" ? "bg-danger-soft text-danger-text" : "bg-warning-soft text-warning-text"
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-xl font-semibold leading-6 tabular", clear && "text-muted-foreground")}>{i.count}</span>
                  <span className="block text-xs font-medium leading-4">{i.label}</span>
                  <span className="block text-2xs text-muted-foreground">{i.detail}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
