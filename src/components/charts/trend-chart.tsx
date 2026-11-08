"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import * as React from "react";
import { AXIS, ChartTooltip, GRID, SERIES } from "./chart-kit";
import { shortDay } from "@/lib/metrics";

/** Single-series trend (area). One measure per chart — never dual axes. */
export function TrendChart<T extends { date: string }>({
  data,
  dataKey,
  name,
  format,
  domain,
  target,
  color = SERIES[0],
  height = 200,
}: {
  data: T[];
  dataKey: keyof T & string;
  name: string;
  format: (v: number) => string;
  domain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  target?: { value: number; label: string };
  color?: string;
  height?: number;
}) {
  const id = React.useId().replace(/:/g, "");
  const values = data.map((d) => Number(d[dataKey]));
  const summary = values.length
    ? `${name} trend from ${shortDay(data[0].date)} to ${shortDay(data[data.length - 1].date)}: latest ${format(values[values.length - 1])}, low ${format(Math.min(...values))}, high ${format(Math.max(...values))}.`
    : "No data";
  return (
    <div style={{ height }} role="img" aria-label={summary}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`tc-${id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.12} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="date" {...AXIS} tickFormatter={shortDay} minTickGap={28} />
          <YAxis {...AXIS} width={44} domain={domain ?? ["auto", "auto"]} tickFormatter={(v) => format(Number(v))} />
          {target && <ReferenceLine y={target.value} stroke="#9CA3AF" strokeDasharray="4 4" label={{ value: target.label, position: "insideTopRight", fill: "#6B7280", fontSize: 10 }} />}
          <Tooltip content={<ChartTooltip labelFormatter={shortDay} formatter={(v) => format(v)} />} cursor={{ stroke: "#CBD2DC" }} />
          <Area type="monotone" dataKey={dataKey} name={name} stroke={color} strokeWidth={2} fill={`url(#tc-${id})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
