"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeftRight, Barcode, Pencil, SlidersHorizontal } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductThumb } from "@/components/shared/product-thumb";
import { StatusBadge } from "@/components/shared/status-badge";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { EmptyState } from "@/components/shared/empty-state";
import { useWms } from "@/store/wms-store";
import { STOCK_STATUS, PRODUCT_STATUS } from "@/lib/status";
import { formatCurrency, formatDate, formatNumber, formatRelative } from "@/lib/format";
import { WAREHOUSES } from "@/lib/constants";

export function InventoryDrawer({ productId, onOpenChange }: { productId: string | null; onOpenChange: (open: boolean) => void }) {
  const { products, suppliers, inventory, all, activity, warehouse, orders, inbound } = useWms();
  const product = products.find((p) => p.id === productId);
  const rows = inventory.filter((r) => r.productId === productId);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const available = rows.reduce((s, r) => s + r.available, 0);
  const reserved = rows.reduce((s, r) => s + r.reserved, 0);
  const scale = warehouse.id === "WH-ATL" ? 1 : warehouse.id === "WH-DAL" ? 0.55 : 0.42;
  const min = product ? Math.round(product.minStock * scale) : 0;
  const max = product ? Math.round(product.maxStock * scale) : 0;
  const supplier = suppliers.find((s) => s.id === product?.supplierId);
  const events = activity.filter((a) => product && (a.entity === product.sku || a.details.includes(product.sku))).slice(0, 10);
  const openOrders = orders.filter((o) => !["shipped", "delivered", "cancelled"].includes(o.status) && o.lines.some((l) => l.productId === productId));
  const incoming = inbound.filter((s) => s.status !== "completed" && s.lines.some((l) => l.productId === productId));

  return (
    <Sheet open={!!productId} onOpenChange={onOpenChange}>
      <SheetContent width="lg">
        {product && (
          <>
            <SheetHeader>
              <div className="flex gap-3">
                <ProductThumb category={product.category} imageUrl={product.imageUrl} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{product.name}</SheetTitle>
                  <SheetDescription className="mt-0.5 flex items-center gap-2 font-mono">
                    {product.sku}
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Barcode className="size-3" /> {product.barcode}
                    </span>
                  </SheetDescription>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {rows[0] && <StatusBadge map={STOCK_STATUS} value={rows[0].status} />}
                    <StatusBadge map={PRODUCT_STATUS} value={product.status} dot={false} />
                    <Badge>{product.category}</Badge>
                    {product.storage !== "ambient" && <Badge tone={product.storage === "chilled" ? "cyan" : product.storage === "hazmat" ? "danger" : "violet"}>{product.storage}</Badge>}
                  </div>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className="space-y-5">
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["On hand", total],
                  ["Available", available],
                  ["Reserved", reserved],
                  ["Inbound", incoming.reduce((s, x) => s + x.lines.filter((l) => l.productId === productId).reduce((a, l) => a + l.expected - l.received, 0), 0)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-md border bg-subtle px-3 py-2">
                    <div className="text-2xs text-muted-foreground">{k}</div>
                    <div className="text-base font-semibold tabular">{formatNumber(v as number)}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-2xs text-muted-foreground tabular">
                  <span>Min {formatNumber(min)}</span>
                  <span>{max ? Math.round((total / max) * 100) : 0}% of max</span>
                  <span>Max {formatNumber(max)}</span>
                </div>
                <div className="relative">
                  <Progress value={max ? (total / max) * 100 : 0} size="md" tone={total < min ? (total === 0 ? "danger" : "warning") : total > max ? "neutral" : "success"} />
                  <span className="absolute top-[-3px] h-4 w-px bg-foreground/50" style={{ left: `${(min / max) * 100}%` }} title="Minimum" />
                </div>
              </div>

              <Tabs defaultValue="locations">
                <TabsList>
                  <TabsTrigger value="locations">Locations ({rows.length})</TabsTrigger>
                  <TabsTrigger value="network">Network</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="locations" className="pt-4">
                  <div className="overflow-hidden rounded-md border">
                    <table className="w-full text-[13px]">
                      <thead className="bg-subtle text-xs text-muted-foreground">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left font-medium">Location</th>
                          <th scope="col" className="px-3 py-2 text-left font-medium">Lot</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Avail.</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Res.</th>
                          <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id} className="border-t">
                            <td className="px-3 py-2">
                              <Link href={`/locations?q=${r.locationCode}`} className="font-mono text-xs text-primary hover:underline">
                                {r.locationCode}
                              </Link>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                              {r.lot}
                              {r.expiresAt && <div className="text-2xs">exp {formatDate(r.expiresAt)}</div>}
                            </td>
                            <td className="px-3 py-2 text-right tabular">{formatNumber(r.available)}</td>
                            <td className="px-3 py-2 text-right tabular text-muted-foreground">{formatNumber(r.reserved)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular">{formatNumber(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {rows.length === 0 && <EmptyState title="Not stocked at this site" />}
                  </div>
                  {(openOrders.length > 0 || incoming.length > 0) && (
                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-md border p-3">
                        <SectionTitle>Open demand</SectionTitle>
                        {openOrders.slice(0, 4).map((o) => (
                          <Link key={o.id} href={`/orders?id=${o.id}`} className="flex justify-between py-0.5 hover:text-primary">
                            <span className="font-mono">{o.id}</span>
                            <span className="tabular">{o.lines.find((l) => l.productId === productId)?.quantity} units</span>
                          </Link>
                        ))}
                        {openOrders.length === 0 && <span className="text-muted-foreground">None</span>}
                      </div>
                      <div className="rounded-md border p-3">
                        <SectionTitle>Incoming supply</SectionTitle>
                        {incoming.slice(0, 4).map((s) => (
                          <Link key={s.id} href={`/inbound?id=${s.id}`} className="flex justify-between py-0.5 hover:text-primary">
                            <span className="font-mono">{s.id}</span>
                            <span className="tabular">{s.lines.find((l) => l.productId === productId)?.expected} units</span>
                          </Link>
                        ))}
                        {incoming.length === 0 && <span className="text-muted-foreground">None</span>}
                      </div>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="network" className="space-y-2 pt-4">
                  {WAREHOUSES.map((w) => {
                    const t = all.inventory.filter((r) => r.warehouseId === w.id && r.productId === productId).reduce((s, r) => s + r.total, 0);
                    const net = all.inventory.filter((r) => r.productId === productId).reduce((s, r) => s + r.total, 0) || 1;
                    return (
                      <div key={w.id} className="rounded-md border p-3">
                        <div className="mb-1.5 flex items-center justify-between text-[13px]">
                          <span className="font-medium">
                            {w.name} {w.id === warehouse.id && <Badge tone="primary">Current</Badge>}
                          </span>
                          <span className="tabular">{formatNumber(t)} units</span>
                        </div>
                        <Progress value={(t / net) * 100} size="xs" />
                      </div>
                    );
                  })}
                </TabsContent>
                <TabsContent value="details" className="pt-4">
                  <p className="mb-4 text-[13px] text-muted-foreground">{product.description}</p>
                  <DescriptionList
                    items={[
                      ["Brand", product.brand],
                      ["Unit of measure", `${product.uom}${product.unitsPerCase > 1 ? ` · ${product.unitsPerCase}/case` : ""}`],
                      ["Weight", `${product.weightKg} kg`],
                      ["Dimensions", `${product.dimensions.length} × ${product.dimensions.width} × ${product.dimensions.height} cm`],
                      ["Unit cost", formatCurrency(product.unitCost, true)],
                      ["Stock value", formatCurrency(total * product.unitCost)],
                      ["Supplier", supplier ? <Link href="/suppliers" className="text-primary hover:underline">{supplier.name}</Link> : "—"],
                      ["Lead time", supplier ? `${supplier.leadTimeDays} days` : "—"],
                      ["Reorder qty", formatNumber(product.reorderQty)],
                      ["Last updated", rows[0] ? formatRelative(rows[0].updatedAt) : "—"],
                    ]}
                  />
                </TabsContent>
                <TabsContent value="history" className="pt-4">
                  {events.length ? <ActivityFeed events={events} /> : <EmptyState title="No recent transactions" description="Movements for this SKU at this site will appear here." />}
                </TabsContent>
              </Tabs>
            </SheetBody>
            <SheetFooter className="justify-between">
              <Button variant="ghost" asChild>
                <Link href={`/products?edit=${product.id}`}>
                  <Pencil /> Edit product
                </Link>
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" asChild>
                  <Link href={`/adjustments?new=1&sku=${encodeURIComponent(product.sku)}`}>
                    <SlidersHorizontal /> Adjust
                  </Link>
                </Button>
                <Button asChild>
                  <Link href={`/transfers?new=1&sku=${encodeURIComponent(product.sku)}`}>
                    <ArrowLeftRight /> Transfer
                  </Link>
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
