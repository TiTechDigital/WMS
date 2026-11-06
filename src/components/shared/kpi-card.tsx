import * as React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/charts/sparkline";

export function KpiCard({
  label,
  value,
  unit,
  delta,
  deltaLabel = "vs last week",
  positiveIsGood = true,
  icon: Icon,
  trend,
  href,
  footer,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  positiveIsGood?: boolean;
  icon?: React.ElementType;
  trend?: number[];
  href?: string;
  footer?: React.ReactNode;
  tone?: "default" | "warning" | "danger";
}) {
  const good = delta == null ? null : positiveIsGood ? delta >= 0 : delta <= 0;
  const body = (
    <div
      className={cn(
        "group flex h-full flex-col rounded-lg border bg-surface p-4 shadow-card transition-colors",
        href && "hover:border-primary/30 hover:bg-subtle"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded",
              tone === "danger" ? "bg-danger-soft text-danger" : tone === "warning" ? "bg-warning-soft text-[hsl(32_95%_38%)]" : "bg-accent text-muted-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-2xs">
        {delta != null && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", good ? "text-success" : "text-danger")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {delta != null && <span className="text-muted-foreground">{deltaLabel}</span>}
        {footer}
      </div>
      {trend && (
        <div className="-mx-1 mt-3">
          <Sparkline data={trend} color={tone === "danger" ? "#DC2626" : tone === "warning" ? "#F59E0B" : "#2563EB"} />
        </div>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}
