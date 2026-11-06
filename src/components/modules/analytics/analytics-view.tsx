"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker, presetRange, type DateRange } from "@/components/shared/date-range-picker";
import { KpiCard } from "@/components/shared/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { InOutChart } from "../dashboard/dashboard-charts";
import { AXIS, ChartTooltip, GRID, Legend, SERIES } from "@/components/charts/chart-kit";
import { bucketMetrics, pctChange, shortDay, sliceMetrics } from "@/lib/metrics";
import { formatCompact, formatNumber } from "@/lib/format";
import { downloadCsv } from "@/lib/csv";
import { CATEGORIES, type DailyMetric } from "@/types";
import { ProductThumb } from "@/components/shared/product-thumb";

function agg(m: DailyMetric[]) {
  const n = m.length || 1;
  const sum = (k: keyof DailyMetric) => m.reduce((s, d) => s + (d[k] as number), 0);
  const avgSoh = sum("stockOnHand") / n;
  return {
    inbound: sum("inbound"),
    outbound: sum("outbound"),
    turnover: avgSoh ? (sum("outbound") / avgSoh) * (365 / n) : 0,
    accuracy: sum("accuracy") / n,
    fulfillment: Math.min(100, (sum("ordersShipped") / (sum("ordersReceived") || 1)) * 100),
    onTime: sum("onTimeRate") / n,
    pickTime: sum("avgPickMinutes") / n,
    utilization: sum("utilization") / n,
  };
}

export function AnalyticsView() {
  const { metrics, inventory, orders, warehouse, all } = useWms();
  const [range, setRange] = React.useState<DateRange>(presetRange("90d"));
  const [compare, setCompare] = React.useState(true);
  const [grain, setGrain] = React.useState<"auto" | "day" | "week">("auto");

  const curr = React.useMemo(() => sliceMetrics(metrics, range), [metrics, range]);
  const prev = React.useMemo(() => {
    const idx = metrics.findIndex((d) => d.date >= range.from);
    const n = curr.length;
    return idx > 0 ? metrics.slice(Math.max(0, idx - n), idx) : [];
  }, [metrics, range.from, curr.length]);
  const a = agg(curr);
  const b = agg(prev);
  const d = (x: number, y: number) => (compare && prev.length ? pctChange(x, y) : undefined);

  const volume = React.useMemo(() => (grain === "day" ? curr.map((m) => ({ ...m, label: m.date })) : grain === "week" ? bucketMetrics(curr, Math.ceil(curr.length / 7)) : bucketMetrics(curr)), [curr, grain]);

  const turnoverByCat = React.useMemo(() => {
    const units = new Map<string, number>();
    inventory.forEach((r) => units.set(r.category, (units.get(r.category) ?? 0) + r.total));
    const shipped = new Map<string, number>();
    const cat = new Map(all.products.map((p) => [p.id, p.category]));
    orders.forEach((o) => o.lines.forEach((l) => shipped.set(cat.get(l.productId) ?? "", (shipped.get(cat.get(l.productId) ?? "") ?? 0) + l.quantity)));
    const totalShipped = [...shipped.values()].reduce((s, v) => s + v, 0) || 1;
    return CATEGORIES.map((c) => {
      const share = (shipped.get(c) ?? 0) / totalShipped;
      const annualOut = a.outbound * share * (365 / (curr.length || 1));
      return { category: c, turnover: Number((annualOut / (units.get(c) || 1)).toFixed(1)) };
    })
      .filter((x) => Number.isFinite(x.turnover))
      .sort((x, y) => y.turnover - x.turnover);
  }, [inventory, orders, all.products, a.outbound, curr.length]);

  const topMovers = React.useMemo(() => {
    const m = new Map<string, { sku: string; name: string; units: number; orders: number; productId: string }>();
    orders.forEach((o) =>
      o.lines.forEach((l) => {
        const e = m.get(l.sku) ?? { sku: l.sku, name: l.productName, units: 0, orders: 0, productId: l.productId };
        e.units += l.quantity;
        e.orders += 1;
        m.set(l.sku, e);
      })
    );
    return [...m.values()].sort((x, y) => y.units - x.units).slice(0, 8);
  }, [orders]);
  const cat = new Map(all.products.map((p) => [p.id, p.category]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        description={`Operational performance · ${warehouse.name}`}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-md border bg-surface px-2.5 py-1.5 shadow-card">
              <Switch id="cmp" checked={compare} onCheckedChange={setCompare} />
              <Label htmlFor="cmp" className="text-xs font-normal">
                Compare to previous period
              </Label>
            </div>
            <Select value={grain} onValueChange={(v) => setGrain(v as typeof grain)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto interval</SelectItem>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker value={range} onChange={setRange} />
            <Button
              variant="secondary"
              onClick={() => {
                downloadCsv(`analytics-${warehouse.id}-${range.from}_${range.to}.csv`, curr.map((m) => ({ ...m })) as unknown as Record<string, string | number>[]);
                toast.success("Analytics exported", { description: `${curr.length} days of KPI data` });
              }}
            >
              <Download /> Export
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Inventory turnover" value={a.turnover.toFixed(1)} unit="× / yr" delta={d(a.turnover, b.turnover)} deltaLabel="vs prev." />
        <KpiCard label="Stock accuracy" value={`${a.accuracy.toFixed(2)}%`} delta={d(a.accuracy, b.accuracy)} deltaLabel="vs prev." />
        <KpiCard label="Fulfillment rate" value={`${a.fulfillment.toFixed(1)}%`} delta={d(a.fulfillment, b.fulfillment)} deltaLabel="vs prev." />
        <KpiCard label="Avg. picking time" value={a.pickTime.toFixed(1)} unit="min / line" delta={d(a.pickTime, b.pickTime)} positiveIsGood={false} deltaLabel="vs prev." />
        <KpiCard label="Capacity utilization" value={`${a.utilization.toFixed(1)}%`} delta={d(a.utilization, b.utilization)} deltaLabel="vs prev." />
        <KpiCard label="Inbound volume" value={formatCompact(a.inbound)} unit="units" delta={d(a.inbound, b.inbound)} deltaLabel="vs prev." />
        <KpiCard label="Outbound volume" value={formatCompact(a.outbound)} unit="units" delta={d(a.outbound, b.outbound)} deltaLabel="vs prev." />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Inbound & outbound volume" description={volume.length < curr.length ? "Units per week" : "Units per day"} />
          <CardContent>
            <InOutChart data={volume} height={260} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Inventory turnover by category" description="Annualised · current stock" />
          <CardContent>
            <div style={{ height: 290 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={turnoverByCat} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 0 }} barCategoryGap={6}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="category" {...AXIS} width={118} tick={{ fill: "#374151", fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "#F1F3F6" }} content={<ChartTooltip formatter={(v) => `${v.toFixed(1)}× / yr`} />} />
                  <Bar dataKey="turnover" name="Turnover" fill={SERIES[0]} radius={[0, 3, 3, 0]} maxBarSize={16} isAnimationActive={false}>
                    <LabelList dataKey="turnover" position="right" formatter={(v: number) => `${v}×`} style={{ fill: "#6B7280", fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader title="Order fulfillment rate" description="On-time shipped %" />
          <CardContent>
            <TrendChart data={curr} dataKey="onTimeRate" name="On-time" format={(v) => `${v.toFixed(0)}%`} domain={[90, 100]} target={{ value: 97, label: "SLA 97%" }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Stock accuracy" description="Cycle count match rate" />
          <CardContent>
            <TrendChart data={curr} dataKey="accuracy" name="Accuracy" format={(v) => `${v.toFixed(1)}%`} domain={[98.8, 100]} target={{ value: 99.5, label: "Target" }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Average picking time" description="Minutes per order line" />
          <CardContent>
            <TrendChart data={curr} dataKey="avgPickMinutes" name="Pick time" format={(v) => `${v.toFixed(1)}m`} domain={[2, 5]} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Capacity utilization" description="Occupied storage %" />
          <CardContent>
            <TrendChart data={curr} dataKey="utilization" name="Utilization" format={(v) => `${v.toFixed(0)}%`} domain={[50, 100]} target={{ value: 85, label: "Comfort 85%" }} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Orders received vs shipped" description={volume.length < curr.length ? "Orders per week" : "Orders per day"} />
          <CardContent>
            <Legend className="mb-3" items={[{ label: "Received", color: SERIES[0] }, { label: "Shipped", color: SERIES[1] }]} />
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="date" {...AXIS} minTickGap={24} tickFormatter={shortDay} />
                  <YAxis {...AXIS} width={44} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip content={<ChartTooltip labelFormatter={shortDay} formatter={(v) => `${formatNumber(v)} orders`} />} cursor={{ fill: "#F1F3F6" }} />
                  <Bar dataKey="ordersReceived" name="Received" fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                  <Bar dataKey="ordersShipped" name="Shipped" fill={SERIES[1]} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Top movers" description="Units ordered · last 10 days" />
          <div className="divide-y">
            {topMovers.map((t, i) => (
              <div key={t.sku} className="flex items-center gap-3 px-4 py-2">
                <span className="w-4 text-2xs tabular text-muted-foreground">{i + 1}</span>
                <ProductThumb category={cat.get(t.productId) ?? "Packaging"} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{t.name}</div>
                  <div className="font-mono text-2xs text-muted-foreground">{t.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium tabular">{formatNumber(t.units)}</div>
                  <div className="text-2xs text-muted-foreground">{t.orders} orders</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
