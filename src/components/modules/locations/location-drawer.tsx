"use client";

import Link from "next/link";
import { Ban, CheckCircle2, ClipboardCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Progress, utilizationTone } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { SectionTitle } from "@/components/shared/description-list";
import { EmptyState } from "@/components/shared/empty-state";
import { useWms } from "@/store/wms-store";
import { LOCATION_STATUS, LOCATION_TYPE_LABEL, STOCK_STATUS } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/format";
import type { Location } from "@/types";

export function LocationDrawer({ location, onOpenChange }: { location: Location | null; onOpenChange: (v: boolean) => void }) {
  const { inventory, warehouse, zones, actions, can } = useWms();
  const items = location ? inventory.filter((r) => r.locationCode === location.code) : [];
  const zone = zones.find((z) => z.code === location?.zone);
  const pct = location && location.capacity ? (location.occupied / location.capacity) * 100 : 0;

  const hierarchy = location
    ? [
        ["Warehouse", warehouse.id],
        ["Zone", `${location.zone} · ${zone?.name ?? ""}`],
        ["Aisle", location.aisle],
        ["Rack", location.rack],
        ["Shelf", location.shelf],
        ["Bin", location.bin],
      ]
    : [];

  const canStatus = can("locations.status");
  const setStatus = async (s: Location["status"]) => {
    if (!location) return;
    if (!(await actions.setLocationStatus(location.id, s))) return;
    toast.success(`${location.code} set to ${LOCATION_STATUS[s].label.toLowerCase()}`);
  };

  return (
    <Sheet open={!!location} onOpenChange={onOpenChange}>
      <SheetContent width="md">
        {location && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono">{location.code}</SheetTitle>
              <SheetDescription>
                {LOCATION_TYPE_LABEL[location.type]} · {zone?.name}
                {zone?.temperature ? ` · ${zone.temperature}` : ""}
              </SheetDescription>
              <div className="mt-2">
                <StatusBadge map={LOCATION_STATUS} value={location.status} />
              </div>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <div>
                <SectionTitle>Address</SectionTitle>
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {hierarchy.map(([k, v], i) => (
                    <span key={k} className="flex items-center gap-1">
                      <span className="rounded border bg-subtle px-1.5 py-1">
                        <span className="block text-[10px] text-muted-foreground">{k}</span>
                        <span className="font-mono font-medium">{v}</span>
                      </span>
                      {i < hierarchy.length - 1 && <span className="text-muted-foreground">›</span>}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <SectionTitle>Occupancy</SectionTitle>
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-semibold tabular">{pct.toFixed(0)}%</span>
                  <span className="text-xs text-muted-foreground tabular">
                    {formatNumber(location.occupied)} / {formatNumber(location.capacity)} {location.type === "dock" ? "trailer" : "units"}
                  </span>
                </div>
                <Progress value={pct} tone={utilizationTone(pct)} size="md" className="mt-2" />
                <div className="mt-2 text-2xs text-muted-foreground">Last counted {formatDate(location.lastCountedAt)}</div>
              </div>
              <div>
                <SectionTitle>Assigned products ({items.length})</SectionTitle>
                {items.length ? (
                  <div className="divide-y rounded-md border">
                    {items.map((r) => (
                      <Link key={r.id} href={`/inventory?q=${r.sku}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-subtle">
                        <ProductThumb category={r.category} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px]">{r.productName}</div>
                          <div className="font-mono text-2xs text-muted-foreground">
                            {r.sku} · {r.lot}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[13px] font-medium tabular">{formatNumber(r.total)}</div>
                          <StatusBadge map={STOCK_STATUS} value={r.status} dot={false} />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Empty location" description={location.status === "active" ? "Available for putaway." : "Not available for putaway."} className="rounded-md border py-8" />
                )}
              </div>
            </SheetBody>
            <SheetFooter className="justify-between">
              <Button
                variant="secondary"
                onClick={() => {
                  actions.log({ module: "Inventory", action: "Cycle count scheduled", entity: location.code, details: "Ad-hoc count requested", severity: "info" });
                  toast.success("Count task created", { description: `${location.code} added to the RF count queue` });
                }}
              >
                <ClipboardCheck /> Count
              </Button>
              <div className="flex gap-2">
                {canStatus && location.status !== "active" && (
                  <Button variant="secondary" onClick={() => setStatus("active")}>
                    <CheckCircle2 /> Activate
                  </Button>
                )}
                {canStatus && location.status !== "maintenance" && (
                  <Button variant="secondary" onClick={() => setStatus("maintenance")}>
                    <Wrench /> Maintenance
                  </Button>
                )}
                {canStatus && location.status !== "blocked" && (
                  <Button variant="danger" onClick={() => setStatus("blocked")}>
                    <Ban /> Block
                  </Button>
                )}
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
