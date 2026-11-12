"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, LabelList } from "recharts";
import { AXIS, ChartEmpty, ChartTooltip, GRID, Legend, SERIES } from "@/components/charts/chart-kit";
import { formatCompact, formatNumber } from "@/lib/format";
import { shortDay } from "@/lib/metrics";
import type { DailyMetric } from "@/types";

type Row = DailyMetric & { label?: string };

export function StockMovementChart({ data, height = 240 }: { data: Row[]; height?: number }) {
  if (!data.length) return <ChartEmpty height={height} message="Stock history appears after the first day of activity" />;
  const min = Math.min(...data.map((d) => d.stockOnHand));
  const max = Math.max(...data.map((d) => d.stockOnHand));
  const pad = (max - min) * 0.25 || 1000;
  const first = data[0];
  const last = data[data.length - 1];
  const summary = first && last ? `Line chart of stock on hand from ${shortDay(first.date)} to ${shortDay(last.date)}: ${formatNumber(first.stockOnHand)} to ${formatNumber(last.stockOnHand)} units, low ${formatNumber(min)}, high ${formatNumber(max)}.` : "No data";
  return (
    <div style={{ height }} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="soh" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.14} />
              <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
          <YAxis {...AXIS} width={52} domain={[Math.max(0, Math.floor((min - pad) / 1000) * 1000), Math.ceil((max + pad) / 1000) * 1000]} tickFormatter={(v) => formatCompact(v)} />
          <Tooltip content={<ChartTooltip labelFormatter={shortDay} formatter={(v) => `${formatNumber(v)} units`} />} cursor={{ stroke: "#CBD2DC", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="stockOnHand" name="Stock on hand" stroke={SERIES[0]} strokeWidth={2} fill="url(#soh)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InOutChart({ data, height = 240 }: { data: Row[]; height?: number }) {
  if (!data.length) return <ChartEmpty height={height} message="No inbound or outbound movements in this period" />;
  const totals = data.reduce((a, d) => ({ i: a.i + d.inbound, o: a.o + d.outbound }), { i: 0, o: 0 });
  return (
    <div>
      <Legend
        className="mb-3"
        items={[
          { label: "Inbound", color: SERIES[0], value: formatCompact(totals.i) },
          { label: "Outbound", color: SERIES[1], value: formatCompact(totals.o) },
        ]}
      />
      <div style={{ height }} role="img" aria-label={`Bar chart of inbound and outbound units: ${formatNumber(totals.i)} received and ${formatNumber(totals.o)} shipped over ${data.length} periods.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barGap={2} barCategoryGap="22%">
            <CartesianGrid {...GRID} />
            <XAxis dataKey="date" {...AXIS} tickFormatter={shortDay} minTickGap={20} />
            <YAxis {...AXIS} width={44} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip content={<ChartTooltip labelFormatter={shortDay} formatter={(v) => `${formatNumber(v)} units`} />} cursor={{ fill: "#F1F3F6" }} />
            <Bar dataKey="inbound" name="Inbound" fill={SERIES[0]} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
            <Bar dataKey="outbound" name="Outbound" fill={SERIES[1]} radius={[3, 3, 0, 0]} maxBarSize={14} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CategoryDistributionChart({ data, height = 280 }: { data: { category: string; units: number; skus: number }[]; height?: number }) {
  if (!data.length) return <ChartEmpty height={height} message="No stock on hand yet" />;
  const total = data.reduce((s, d) => s + d.units, 0) || 1;
  const summary = `Bar chart of units on hand by category: ${data.map((d) => `${d.category} ${formatNumber(d.units)}`).join(", ")}.`;
  return (
    <div style={{ height }} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 44, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" {...AXIS} width={118} tick={{ fill: "#374151", fontSize: 11 }} />
          <Tooltip
            cursor={{ fill: "#F1F3F6" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border bg-surface px-3 py-2 text-xs shadow-pop">
                  <div className="mb-1 font-medium">{payload[0].payload.category}</div>
                  <div className="flex justify-between gap-6 text-muted-foreground">
                    Units <span className="font-medium tabular text-foreground">{formatNumber(payload[0].payload.units)}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-muted-foreground">
                    SKUs <span className="font-medium tabular text-foreground">{payload[0].payload.skus}</span>
                  </div>
                  <div className="flex justify-between gap-6 text-muted-foreground">
                    Share <span className="font-medium tabular text-foreground">{((payload[0].payload.units / total) * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="units" name="Units" radius={[0, 3, 3, 0]} isAnimationActive={false} maxBarSize={16}>
            {data.map((d, i) => (
              <Cell key={d.category} fill={i === 0 ? SERIES[0] : "#93B4F5"} />
            ))}
            <LabelList dataKey="units" position="right" formatter={(v: number) => formatCompact(v)} style={{ fill: "#6B7280", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FulfillmentChart({ data, height = 160, target = 97 }: { data: Row[]; height?: number; target?: number }) {
  if (!data.length) return <ChartEmpty height={height} message="No shipments in this period" />;
  const avg = data.length ? data.reduce((s, d) => s + d.onTimeRate, 0) / data.length : 0;
  const below = data.filter((d) => d.onTimeRate < target).length;
  return (
    <div style={{ height }} role="img" aria-label={`Line chart of on-time shipping rate: average ${avg.toFixed(1)}%, below the ${target}% target on ${below} of ${data.length} days.`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
          <YAxis {...AXIS} width={36} domain={[90, 100]} ticks={[90, 94, 97, 100]} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={target} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: `Target ${target}%`, position: "insideBottomRight", fill: "#6B7280", fontSize: 10 }} />
          <Tooltip content={<ChartTooltip labelFormatter={shortDay} formatter={(v) => `${v.toFixed(1)}%`} />} cursor={{ stroke: "#CBD2DC" }} />
          <Line type="monotone" dataKey="onTimeRate" name="On-time shipped" stroke={SERIES[0]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
