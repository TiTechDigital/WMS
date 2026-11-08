import * as React from "react";
import { cn } from "@/lib/utils";

export function DescriptionList({ items, columns = 2, className }: { items: [React.ReactNode, React.ReactNode][]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 1 && "grid-cols-1", columns === 2 && "grid-cols-2", columns === 3 && "grid-cols-3", className)}>
      {items.map(([k, v], i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{k}</dt>
          <dd className="mt-0.5 truncate text-[13px] text-foreground">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="text-xs font-semibold text-foreground">{children}</h3>
      {action}
    </div>
  );
}
