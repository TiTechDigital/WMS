import { ArrowLeftRight, Boxes, Cog, MapPin, PackageOpen, PackageSearch, ScanLine, SlidersHorizontal, Truck, UserRound } from "lucide-react";
import type { ActivityEvent, LogModule } from "@/types";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";

export const MODULE_ICON: Record<LogModule, React.ElementType> = {
  Inventory: Boxes,
  Inbound: PackageOpen,
  Outbound: Truck,
  Picking: ScanLine,
  Transfers: ArrowLeftRight,
  Adjustments: SlidersHorizontal,
  Products: PackageSearch,
  Locations: MapPin,
  Users: UserRound,
  System: Cog,
};

const SEV_CLS: Record<ActivityEvent["severity"], string> = {
  info: "bg-accent text-muted-foreground",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  critical: "bg-danger-soft text-danger-text",
};

export function ActivityIcon({ event }: { event: ActivityEvent }) {
  const Icon = MODULE_ICON[event.module] ?? Cog;
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", SEV_CLS[event.severity])}>
      <Icon className="size-3.5" />
    </span>
  );
}

export function ActivityFeed({ events, className }: { events: ActivityEvent[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-3.5 last:pb-0">
          {i < events.length - 1 && <span className="absolute left-3.5 top-8 h-[calc(100%-2rem)] w-px bg-border" />}
          <ActivityIcon event={e} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[13px] font-medium">{e.action}</span>
              <span className="ml-auto shrink-0 text-2xs text-muted-foreground">{formatRelative(e.timestamp)}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              <span className="font-mono text-[11px] text-foreground/80">{e.entity}</span> · {e.details}
            </div>
            <div className="text-2xs text-muted-foreground">
              {e.actor} · {e.source}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
