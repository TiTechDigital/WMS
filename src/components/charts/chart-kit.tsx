"use client";

/**
 * Shared chart styling. Categorical order is fixed (never cycled): slot 1 is the brand
 * blue, slot 2 a validated orange. Validated with the dataviz palette checker
 * (CVD ΔE ≥ 9 for adjacent pairs). Status colours are never used as series colours.
 */
import * as React from "react";
import type { TooltipProps } from "recharts";
import { cn } from "@/lib/utils";

export const SERIES = ["#2563EB", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;
/** Single-hue sequential ramp (light → dark) for magnitude. */
export const SEQ_BLUE = ["#dbe7fd", "#b4cdfb", "#84acf6", "#5089f0", "#2563EB", "#1b4fc4", "#163f9b"];

export const AXIS = {
  stroke: "transparent",
  tick: { fill: "#6B7280", fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;
export const GRID = { stroke: "#EEF0F3", strokeDasharray: "0", vertical: false } as const;

type Fmt = (v: number, name?: string) => string;

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: TooltipProps<number, string> & { formatter?: Fmt; labelFormatter?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-md border bg-surface px-3 py-2 text-xs shadow-pop">
      {label != null && <div className="mb-1.5 font-medium text-foreground">{labelFormatter ? labelFormatter(String(label)) : label}</div>}
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-[2px]" style={{ background: (p.color as string) ?? (p.payload?.fill as string) }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-medium tabular text-foreground">
              {formatter ? formatter(Number(p.value), String(p.name)) : Number(p.value).toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; value?: React.ReactNode }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
          {i.value != null && <span className="font-medium tabular text-foreground">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/** Shown in place of a chart when there's no data for the selected period. */
export function ChartEmpty({ height = 200, message = "No data for this period yet" }: { height?: number; message?: string }) {
  return (
    <div style={{ height }} className="flex items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
      {message}
    </div>
  );
}
