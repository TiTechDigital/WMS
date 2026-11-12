"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ArrowUpRight, Boxes, ClipboardList, Download, PackageOpen, Tags, Truck, Users } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, utilizationTone } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { DateRangePicker, presetRange, type DateRange } from "@/components/shared/date-range-picker";
import { ExceptionsStrip } from "./exceptions-strip";
import { StockMovementChart, InOutChart, CategoryDistributionChart, FulfillmentChart } from "./dashboard-charts";
import { INBOUND_STATUS, PRIORITY, STOCK_STATUS } from "@/lib/status";
import { formatCompact, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { bucketMetrics, periodDelta, sliceMetrics } from "@/lib/metrics";
import { downloadCsv } from "@/lib/csv";
import { currentTime } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

function shiftName() {
  const h = new Date().getHours();
  return h >= 6 && h < 14 ? "Morning shift" : h >= 14 && h < 22 ? "Afternoon shift" : "Night shift";
}

function greeting() {
  const h = new Date().getHours(); // the viewer's local time
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardView() {
  const { warehouse, inventory, orders, inbound, pickTasks, metrics, activity, locations, zones, products, employees, actions, user } = useWms();
  const [range, setRange] = React.useState<DateRange>(presetRange("30d"));
  const [actTab, setActTab] = React.useState<"all" | "alerts">("all");

  const series = React.useMemo(() => sliceMetrics(metrics, range), [metrics, range]);
  const bucketed = React.useMemo(() => bucketMetrics(series), [series]);

  const kpi = React.useMemo(() => {
    const skuSet = new Set(inventory.map((r) => r.productId));
    const units = inventory.reduce((s, r) => s + r.total, 0);
    const lowSkus = new Set(inventory.filter((r) => r.status === "low_stock" || r.status === "out_of_stock").map((r) => r.productId));
    const pending = orders.filter((o) => ["new", "allocated", "picking", "packing", "on_hold"].includes(o.status));
    const incoming = inbound.filter((s) => s.status !== "completed");
    const outgoing = orders.filter((o) => o.status === "ready_to_ship" || (o.status === "shipped" && o.shippedAt && currentTime().getTime() - new Date(o.shippedAt).getTime() < 86400000));
    return {
      skus: skuSet.size,
      units,
      pending: pending.length,
      incoming: incoming.length,
      incomingToday: incoming.filter((s) => s.expectedAt.slice(0, 10) === currentTime().toISOString().slice(0, 10)).length,
      outgoing: outgoing.length,
      ready: orders.filter((o) => o.status === "ready_to_ship").length,
      low: lowSkus.size,
      out: new Set(inventory.filter((r) => r.status === "out_of_stock").map((r) => r.productId)).size,
    };
  }, [inventory, orders, inbound]);

  const hasHistory = metrics.length >= 14;
  const delta = (key: Parameters<typeof periodDelta>[1], mode?: "sum" | "avg") => (hasHistory ? periodDelta(metrics, key, 7, mode) : undefined);
  const trend = (key: "stockOnHand" | "ordersReceived" | "inbound" | "outbound") => metrics.slice(-21).map((d) => d[key]);

  const categoryData = React.useMemo(() => {
    const map = new Map<Category, { units: number; skus: Set<string> }>();
    inventory.forEach((r) => {
      const e = map.get(r.category) ?? { units: 0, skus: new Set<string>() };
      e.units += r.total;
      e.skus.add(r.productId);
      map.set(r.category, e);
    });
    return [...map.entries()].map(([category, v]) => ({ category, units: v.units, skus: v.skus.size })).sort((a, b) => b.units - a.units);
  }, [inventory]);

  const capacity = React.useMemo(() => {
    const storage = locations.filter((l) => l.type !== "staging" && l.type !== "dock");
    const byZone = zones
      .filter((z) => z.type !== "staging" && z.type !== "dock")
      .map((z) => {
        const ls = storage.filter((l) => l.zone === z.code);
        const cap = ls.reduce((s, l) => s + l.capacity, 0);
        const occ = ls.reduce((s, l) => s + l.occupied, 0);
        return { zone: z, pct: cap ? (occ / cap) * 100 : 0, locations: ls.length, empty: ls.filter((l) => l.occupied === 0 && l.status === "active").length, blocked: ls.filter((l) => l.status !== "active").length };
      });
    const cap = storage.reduce((s, l) => s + l.capacity, 0);
    const occ = storage.reduce((s, l) => s + l.occupied, 0);
    const docks = locations.filter((l) => l.type === "dock");
    return { byZone, pct: cap ? (occ / cap) * 100 : 0, total: storage.length, empty: storage.filter((l) => l.occupied === 0 && l.status === "active").length, docksBusy: docks.filter((d) => d.occupied > 0).length, docks: docks.length };
  }, [locations, zones]);

  const pendingInbound = React.useMemo(
    () => inbound.filter((s) => ["expected", "arrived", "receiving"].includes(s.status)).sort((a, b) => a.expectedAt.localeCompare(b.expectedAt)).slice(0, 6),
    [inbound]
  );
  const awaitingPick = React.useMemo(
    () =>
      pickTasks
        .filter((t) => t.status === "queued" || t.status === "in_progress" || t.status === "paused")
        .sort((a, b) => PRIORITY[b.priority].rank - PRIORITY[a.priority].rank || a.dueAt.localeCompare(b.dueAt))
        .slice(0, 6),
    [pickTasks]
  );
  const lowStock = React.useMemo(() => {
    const seen = new Map<string, { productId: string; sku: string; name: string; category: Category; total: number; status: "low_stock" | "out_of_stock"; pickLoc: string; reserveLoc?: string; reserveQty: number }>();
    inventory
      .filter((r) => r.status === "low_stock" || r.status === "out_of_stock")
      .forEach((r) => {
        const e = seen.get(r.productId) ?? { productId: r.productId, sku: r.sku, name: r.productName, category: r.category, total: 0, status: r.status as "low_stock", pickLoc: r.locationCode, reserveQty: 0 };
        e.total += r.total;
        if (r.locationCode.includes("-B-") && r.total > 0) {
          e.reserveLoc = r.locationCode;
          e.reserveQty = r.total;
        } else e.pickLoc = r.locationCode;
        seen.set(r.productId, e);
      });
    const scale = warehouse.stockLevelFactor;
    return [...seen.values()]
      .map((e) => {
        const p = products.find((x) => x.id === e.productId);
        const min = Math.round((p?.minStock ?? 1) * scale);
        return { ...e, min, cover: e.total / (min || 1) };
      })
      .sort((a, b) => a.cover - b.cover)
      .slice(0, 7);
  }, [inventory, products, warehouse.stockLevelFactor]);

  const onShift = employees.filter((e) => e.status === "on_shift" || e.status === "on_break");
  const feed = (actTab === "alerts" ? activity.filter((a) => a.severity === "warning" || a.severity === "critical") : activity).slice(0, 8);

  const replenish = async (item: (typeof lowStock)[number]) => {
    if (!item.reserveLoc) return;
    const qty = Math.min(item.reserveQty, Math.max(item.min * 2 - item.total, 1));
    const res = await actions.createTransfer({
      type: "replenishment",
      fromLocation: item.reserveLoc,
      toLocation: item.pickLoc,
      productId: item.productId,
      quantity: qty,
      reason: "Pick face below min",
    });
    if (!res) return;
    toast.success(`Replenishment ${res.id} created`, { description: `${qty} × ${item.sku} from ${item.reserveLoc}`, action: { label: "View", onClick: () => (window.location.href = "/transfers") } });
  };

  const exportSnapshot = () => {
    downloadCsv(`dashboard-${warehouse.id}-${range.from}_${range.to}.csv`, series.map((d) => ({ date: d.date, inbound_units: d.inbound, outbound_units: d.outbound, stock_on_hand: d.stockOnHand, orders_received: d.ordersReceived, orders_shipped: d.ordersShipped, on_time_pct: d.onTimeRate, utilization_pct: d.utilization })));
    toast.success("Dashboard data exported", { description: `${series.length} days · ${warehouse.name}` });
  };

  const totalOnTime = series.length ? series.reduce((s, d) => s + d.onTimeRate, 0) / series.length : 0;
  const fillRate = series.length ? (series.reduce((s, d) => s + d.ordersShipped, 0) / series.reduce((s, d) => s + d.ordersReceived, 0)) * 100 : 0;
  const avgPick = series.length ? series.reduce((s, d) => s + d.avgPickMinutes, 0) / series.length : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${greeting()}, ${user?.name.split(" ")[0] ?? ""}`}
        description={`${warehouse.name} · ${shiftName()} · ${onShift.length} operator${onShift.length === 1 ? "" : "s"} on the floor`}
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button variant="secondary" onClick={exportSnapshot}>
              <Download /> Export
            </Button>
          </>
        }
      />

      <ExceptionsStrip />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total SKUs" value={formatNumber(kpi.skus)} icon={Tags} href="/products" footer={<span className="text-muted-foreground">active in {warehouse.id}</span>} />
        <KpiCard label="Stock units" value={formatCompact(kpi.units)} icon={Boxes} delta={delta("stockOnHand", "avg")} trend={hasHistory ? trend("stockOnHand") : undefined} href="/inventory" />
        <KpiCard label="Pending orders" value={kpi.pending} icon={ClipboardList} delta={delta("ordersReceived")} positiveIsGood={false} href="/orders" />
        <KpiCard label="Incoming shipments" value={kpi.incoming} icon={PackageOpen} delta={delta("inbound")} trend={hasHistory ? trend("inbound") : undefined} href="/inbound" />
        <KpiCard label="Outgoing shipments" value={kpi.outgoing} icon={Truck} delta={delta("outbound")} trend={hasHistory ? trend("outbound") : undefined} href="/outbound" />
        <KpiCard label="Low stock alerts" value={kpi.low} icon={AlertTriangle} tone={kpi.out ? "danger" : "warning"} href="/inventory?status=low_stock" footer={<span className="text-muted-foreground">{kpi.out} out of stock · {kpi.low - kpi.out} below min</span>} />
      </div>

      {/* Row: movement + capacity */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Inventory movement"
            description="Total units on hand at end of day"
            actions={
              <div className="text-right">
                <div className="text-base font-semibold tabular">{formatNumber(series.at(-1)?.stockOnHand ?? 0)}</div>
                <div className="text-2xs text-muted-foreground">units today</div>
              </div>
            }
          />
          <CardContent>
            <StockMovementChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Warehouse capacity" description={`${capacity.total} storage locations · ${capacity.empty} empty`} actions={<Button variant="ghost" size="sm" asChild><Link href="/locations">Layout <ArrowRight /></Link></Button>} />
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-semibold tracking-tight tabular">{capacity.pct.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">overall utilization</div>
              </div>
              <div className="text-right text-xs">
                <div className="font-medium tabular">{capacity.docksBusy}/{capacity.docks}</div>
                <div className="text-muted-foreground">dock doors in use</div>
              </div>
            </div>
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {capacity.byZone.map((z) => (
                <div key={z.zone.code} className={cn("h-full", utilizationTone(z.pct) === "danger" ? "bg-danger" : utilizationTone(z.pct) === "warning" ? "bg-warning" : "bg-primary")} style={{ flex: z.locations, opacity: 0.35 + z.pct / 160 }} />
              ))}
            </div>
            <div className="space-y-3">
              {capacity.byZone.map((z) => (
                <div key={z.zone.code}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="flex size-5 items-center justify-center rounded border bg-subtle font-mono text-[10px] font-semibold">{z.zone.code}</span>
                      <span className="font-medium">{z.zone.name}</span>
                      {z.zone.temperature && <Badge tone="cyan">{z.zone.temperature}</Badge>}
                    </span>
                    <span className="tabular text-muted-foreground">
                      <span className="font-medium text-foreground">{z.pct.toFixed(0)}%</span> · {z.locations} loc
                    </span>
                  </div>
                  <Progress value={z.pct} tone={utilizationTone(z.pct)} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row: in/out + category + fulfilment */}
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Card className="lg:col-span-2 xl:col-span-5">
          <CardHeader title="Incoming vs outgoing goods" description={bucketed.length < series.length ? "Units per week" : "Units per day"} />
          <CardContent>
            <InOutChart data={bucketed} height={222} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader title="Stock distribution by category" description="Units on hand · current" />
          <CardContent className="pt-3">
            <CategoryDistributionChart data={categoryData} height={250} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Order fulfillment" description="Shipped on or before promise date" />
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                ["On-time", `${totalOnTime.toFixed(1)}%`],
                ["Fill rate", `${Math.min(100, fillRate).toFixed(1)}%`],
                ["Avg pick", `${avgPick.toFixed(1)}m`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-md border bg-subtle px-2.5 py-2">
                  <div className="text-2xs text-muted-foreground">{k}</div>
                  <div className="text-sm font-semibold tabular">{v}</div>
                </div>
              ))}
            </div>
            <FulfillmentChart data={series} height={178} />
          </CardContent>
        </Card>
      </div>

      {/* Row: inbound + picking */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Pending inbound deliveries" description={`${kpi.incomingToday} scheduled today`} actions={<Button variant="ghost" size="sm" asChild><Link href="/inbound">All ASNs <ArrowRight /></Link></Button>} />
          <div className="divide-y">
            {pendingInbound.map((s) => {
              const units = s.lines.reduce((a, l) => a + l.expected, 0);
              const recv = s.lines.reduce((a, l) => a + l.received, 0);
              return (
                <Link key={s.id} href={`/inbound?id=${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                  <div className="w-28 shrink-0">
                    <div className="font-mono text-xs font-medium">{s.id}</div>
                    <div className="font-mono text-2xs text-muted-foreground">{s.poNumber}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{s.supplierName}</div>
                    <div className="truncate text-2xs text-muted-foreground">
                      {s.carrier} · {s.pallets} plt · {formatNumber(units)} units
                    </div>
                  </div>
                  <div className="hidden w-20 2xl:block">
                    {s.status === "receiving" ? (
                      <>
                        <Progress value={(recv / units) * 100} size="xs" />
                        <div className="mt-1 text-2xs text-muted-foreground tabular">{Math.round((recv / units) * 100)}% recv.</div>
                      </>
                    ) : (
                      <div className="text-2xs text-muted-foreground">{s.dock ?? "Dock TBA"}</div>
                    )}
                  </div>
                  <div className="flex w-28 shrink-0 flex-col items-end gap-1">
                    <StatusBadge map={INBOUND_STATUS} value={s.status} />
                    <div className="text-2xs tabular text-muted-foreground">{formatDateTime(s.expectedAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title="Orders awaiting picking" description={`${pickTasks.filter((t) => t.status === "queued").length} queued · ${pickTasks.filter((t) => t.status === "in_progress").length} in progress`} actions={<Button variant="ghost" size="sm" asChild><Link href="/picking">Pick console <ArrowRight /></Link></Button>} />
          <div className="divide-y">
            {awaitingPick.map((t) => {
              const qty = t.lines.reduce((a, l) => a + l.quantity, 0);
              const picked = t.lines.reduce((a, l) => a + l.picked, 0);
              return (
                <Link key={t.id} href={`/picking?task=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-subtle">
                  <div className="w-24 shrink-0">
                    <div className="font-mono text-xs font-medium">{t.orderId}</div>
                    <div className="font-mono text-2xs text-muted-foreground">{t.id}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{t.customerName}</div>
                    <div className="truncate text-2xs text-muted-foreground">
                      Zone {t.zone} · {t.lines.length} lines · {t.assigneeName ?? "Unassigned"}
                    </div>
                  </div>
                  <div className="hidden w-24 sm:block">
                    <Progress value={(picked / qty) * 100} size="xs" tone={t.status === "paused" ? "warning" : "primary"} />
                    <div className="mt-1 text-2xs text-muted-foreground tabular">
                      {picked}/{qty} units
                    </div>
                  </div>
                  <div className="flex w-24 shrink-0 flex-col items-end gap-1">
                    <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
                    <div className="text-2xs text-muted-foreground">due {formatRelative(t.dueAt)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Row: low stock + activity + workforce */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader title="Low-stock products" description="Sorted by days of cover" actions={<Button variant="ghost" size="sm" asChild><Link href="/inventory?status=low_stock">View all <ArrowRight /></Link></Button>} />
          <div className="divide-y">
            {lowStock.map((i) => (
              <div key={i.productId} className="flex items-center gap-3 px-4 py-2.5">
                <ProductThumb category={i.category} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{i.name}</div>
                  <div className="truncate font-mono text-2xs text-muted-foreground">
                    {i.sku} · {formatNumber(i.total)}/{formatNumber(i.min)} min
                  </div>
                </div>
                <div className="hidden w-28 md:block xl:hidden 2xl:block">
                  <div className="mb-1 flex justify-between text-2xs tabular text-muted-foreground">
                    <span className="font-medium text-foreground">{formatNumber(i.total)}</span>
                    <span>min {formatNumber(i.min)}</span>
                  </div>
                  <Progress value={(i.total / i.min) * 100} size="xs" tone={i.total === 0 ? "danger" : "warning"} />
                </div>
                <StatusBadge map={STOCK_STATUS} value={i.status} />
                {i.reserveLoc ? (
                  <Button variant="secondary" size="sm" onClick={() => replenish(i)}>
                    Replenish
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" asChild>
                    <Link href={`/inbound?new=1&sku=${encodeURIComponent(i.sku)}`}>
                      Raise PO <ArrowUpRight />
                    </Link>
                  </Button>
                )}
              </div>
            ))}
            {lowStock.length === 0 && <div className="px-4 py-8 text-center text-xs text-muted-foreground">All SKUs are above minimum stock.</div>}
          </div>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            title="Recent activity"
            actions={
              <Tabs value={actTab} onValueChange={(v) => setActTab(v as "all" | "alerts")}>
                <TabsList variant="segmented">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="alerts">Alerts</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          <CardContent className="max-h-[420px] overflow-y-auto scrollbar-thin">
            <ActivityFeed events={feed} />
            <Link href="/activity" className="mt-3 block py-1.5 text-center text-xs font-medium text-primary hover:underline">
              Open activity log
            </Link>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader title="Workforce on shift" description={`${onShift.length} of ${employees.length} operators`} actions={<Button variant="ghost" size="sm" asChild><Link href="/employees"><Users /> Team</Link></Button>} />
          <CardContent className="space-y-3">
            {(["Picker", "Packer", "Receiver", "Forklift Operator", "Inventory Controller"] as const).map((role) => {
              const all = employees.filter((e) => e.role === role);
              const on = all.filter((e) => e.status === "on_shift" || e.status === "on_break");
              return (
                <div key={role} className="flex items-center gap-3 text-xs">
                  <span className="w-24 truncate text-muted-foreground">{role === "Inventory Controller" ? "Inv. Control" : role === "Forklift Operator" ? "Forklift" : role + "s"}</span>
                  <div className="flex flex-1 gap-0.5">
                    {all.map((e) => (
                      <span key={e.id} title={`${e.name} · ${e.status.replace("_", " ")}`} className={cn("h-3 flex-1 rounded-[2px]", e.status === "on_shift" ? "bg-primary" : e.status === "on_break" ? "bg-warning" : "bg-accent")} />
                    ))}
                    {all.length === 0 && <span className="h-3 flex-1 rounded-[2px] bg-accent" />}
                  </div>
                  <span className="w-10 text-right font-medium tabular">
                    {on.length}/{all.length}
                  </span>
                </div>
              );
            })}
            <div className="flex gap-4 border-t pt-3 text-2xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-primary" />Working</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-warning" />Break</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-[2px] bg-accent ring-1 ring-border" />Off</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
