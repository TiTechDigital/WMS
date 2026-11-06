"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export interface Stage {
  key: string;
  label: string;
  count: number;
  hint?: string;
  icon?: React.ElementType;
}

/** Horizontal workflow pipeline. Clicking a stage toggles it as a filter. */
export function StageFlow({ stages, active, onSelect, className }: { stages: Stage[]; active?: string | null; onSelect?: (key: string | null) => void; className?: string }) {
  const total = stages.reduce((s, x) => s + x.count, 0) || 1;
  return (
    <div className={cn("flex overflow-x-auto rounded-lg border bg-surface shadow-card scrollbar-thin", className)}>
      {stages.map((s, i) => {
        const Icon = s.icon;
        const isActive = active === s.key;
        return (
          <button
            key={s.key}
            onClick={() => onSelect?.(isActive ? null : s.key)}
            className={cn(
              "group relative min-w-[132px] flex-1 px-4 py-3 text-left transition-colors hover:bg-subtle focus:outline-none focus-visible:bg-subtle",
              i > 0 && "border-l",
              isActive && "bg-primary-soft/60 hover:bg-primary-soft/80"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn("flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold tabular", isActive ? "border-primary bg-primary text-white" : "bg-surface text-muted-foreground")}>
                {Icon ? <Icon className="size-3" /> : i + 1}
              </span>
              <span className={cn("truncate text-xs font-medium", isActive ? "text-primary" : "text-muted-foreground")}>{s.label}</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl font-semibold tabular tracking-tight">{s.count}</span>
              {s.hint && <span className="truncate text-2xs text-muted-foreground">{s.hint}</span>}
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-accent">
              <div className={cn("h-full rounded-full", isActive ? "bg-primary" : "bg-primary/50")} style={{ width: `${(s.count / total) * 100}%` }} />
            </div>
            {i < stages.length - 1 && (
              <span className="pointer-events-none absolute -right-[5px] top-1/2 z-10 hidden size-2.5 -translate-y-1/2 rotate-45 border-r border-t bg-surface md:block" />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact horizontal progress stepper for a single record's lifecycle. */
export function Stepper({ steps, current, className }: { steps: { key: string; label: string }[]; current: string; className?: string }) {
  const idx = current === "__done" ? steps.length : steps.findIndex((s) => s.key === current);
  return (
    <ol className={cn("flex items-center", className)}>
      {steps.map((s, i) => {
        const done = i < idx;
        const now = i === idx;
        return (
          <li key={s.key} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px] font-semibold",
                  done && "border-primary bg-primary text-white",
                  now && "border-primary bg-primary-soft text-primary ring-2 ring-primary/15",
                  !done && !now && "bg-surface text-muted-foreground"
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-[10px]", now ? "font-semibold text-foreground" : "text-muted-foreground")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && <span className={cn("mx-1 mb-4 h-px flex-1", i < idx ? "bg-primary" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}
