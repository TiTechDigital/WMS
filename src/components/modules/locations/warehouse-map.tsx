"use client";

import * as React from "react";
import { Snowflake, Truck } from "lucide-react";
import { Hint } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LOCATION_STATUS } from "@/lib/status";
import type { Location, Zone } from "@/types";

/** Sequential ramp (one hue, light → dark) for occupancy. */
const RAMP = [
  { max: 0, cls: "bg-surface", label: "Empty" },
  { max: 25, cls: "bg-[#dbe7fd]", label: "1–25%" },
  { max: 50, cls: "bg-[#b4cdfb]", label: "25–50%" },
  { max: 75, cls: "bg-[#84acf6]", label: "50–75%" },
  { max: 90, cls: "bg-[#5089f0]", label: "75–90%" },
  { max: 101, cls: "bg-[#1b4fc4]", label: "90%+" },
];

function cellClass(l: Location) {
  if (l.status === "blocked") return "bg-hatch bg-danger-soft border-danger/40";
  if (l.status === "maintenance") return "bg-warning-soft border-warning/50";
  const pct = l.capacity ? (l.occupied / l.capacity) * 100 : 0;
  if (l.occupied === 0) return "bg-surface";
  return RAMP.find((r) => pct <= r.max && r.max > 0)?.cls ?? RAMP[5].cls;
}

function Cell({ l, onSelect, highlight, className, children }: { l: Location; onSelect: (l: Location) => void; highlight: Set<string> | null; className?: string; children?: React.ReactNode }) {
  const pct = l.capacity ? Math.round((l.occupied / l.capacity) * 100) : 0;
  const dim = highlight && !highlight.has(l.code);
  const hit = highlight && highlight.has(l.code);
  return (
    <Hint
      label={
        <div className="space-y-0.5">
          <div className="font-mono font-medium">{l.code}</div>
          <div className="text-gray-300">
            {l.status !== "active" ? LOCATION_STATUS[l.status].label + " · " : ""}
            {pct}% · {l.occupied}/{l.capacity}
          </div>
        </div>
      }
    >
      <button
        onClick={() => onSelect(l)}
        className={cn(
          "rounded-[3px] border border-black/[0.06] transition-[opacity,transform] hover:z-10 hover:scale-110 hover:ring-2 hover:ring-foreground/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          cellClass(l),
          dim && "opacity-20",
          hit && "ring-2 ring-[#eb6834] ring-offset-1",
          className
        )}
        aria-label={`${l.code}, ${pct}% occupied`}
      >
        {children}
      </button>
    </Hint>
  );
}

function RackZone({ zone, locs, onSelect, highlight }: { zone: Zone; locs: Location[]; onSelect: (l: Location) => void; highlight: Set<string> | null }) {
  const aisles = [...new Set(locs.map((l) => l.aisle))].sort();
  const racks = [...new Set(locs.map((l) => l.rack))].sort();
  const levels = [...new Set(locs.map((l) => l.shelf))].sort().reverse();
  const cap = locs.reduce((s, l) => s + l.capacity, 0);
  const occ = locs.reduce((s, l) => s + l.occupied, 0);
  return (
    <div className={cn("rounded-md border bg-subtle/60 p-3", zone.type === "cold" && "border-cyan-200 bg-cyan-50/40")}>
      <ZoneLabel zone={zone} pct={cap ? (occ / cap) * 100 : 0} count={locs.length} />
      <div className="space-y-2.5">
        {aisles.map((a) => (
          <div key={a} className="flex items-center gap-2">
            <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground">A{a}</span>
            <div className="flex flex-1 gap-1">
              {racks.map((r) => (
                <div key={r} className="flex flex-1 flex-col gap-[3px] rounded-[4px] border border-border/70 bg-surface p-[3px]">
                  {levels.map((lv) => {
                    const l = locs.find((x) => x.aisle === a && x.rack === r && x.shelf === lv);
                    return l ? <Cell key={lv} l={l} onSelect={onSelect} highlight={highlight} className="h-3 w-full" /> : null;
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex gap-2 pl-9">
          <div className="flex flex-1 gap-1">
            {racks.map((r) => (
              <span key={r} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
                R{r}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoneLabel({ zone, pct, count }: { zone: Zone; pct: number; count: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="flex size-5 items-center justify-center rounded bg-foreground font-mono text-[10px] font-semibold text-white">{zone.code}</span>
        <span className="text-xs font-semibold">{zone.name}</span>
        {zone.temperature && (
          <span className="inline-flex items-center gap-1 text-2xs text-cyan-700">
            <Snowflake className="size-3" />
            {zone.temperature}
          </span>
        )}
      </div>
      <span className="text-2xs text-muted-foreground tabular">
        <span className="font-semibold text-foreground">{pct.toFixed(0)}%</span> · {count} loc
      </span>
    </div>
  );
}

export function WarehouseMap({ locations, zones, onSelect, highlight }: { locations: Location[]; zones: Zone[]; onSelect: (l: Location) => void; highlight: Set<string> | null }) {
  const byZone = (code: string) => locations.filter((l) => l.zone === code);
  const z = (code: string) => zones.find((x) => x.code === code);
  const docks = byZone("DK");
  const recv = byZone("R");
  const ship = byZone("S");
  const bulk = byZone("C");

  const Staging = ({ code, title }: { code: string; title: string }) => {
    const ls = code === "R" ? recv : ship;
    return (
      <div className="flex flex-col rounded-md border border-dashed bg-surface p-2">
        <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="flex flex-1 flex-col gap-1">
          {ls.map((l) => (
            <Cell key={l.id} l={l} onSelect={onSelect} highlight={highlight} className="flex h-7 w-full items-center justify-center">
              <span className={cn("font-mono text-[9px]", l.occupied / l.capacity > 0.75 ? "text-white" : "text-muted-foreground")}>{l.rack}</span>
            </Cell>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Dock doors */}
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Docks</span>
        <div className="flex flex-1 gap-1.5">
          {docks.map((d) => (
            <Hint key={d.id} label={`${d.code} · ${d.status !== "active" ? LOCATION_STATUS[d.status].label : d.occupied ? "Trailer at door" : "Available"}`}>
              <button
                onClick={() => onSelect(d)}
                className={cn(
                  "flex h-9 flex-1 flex-col items-center justify-center rounded-b-md border border-t-4 text-[9px] transition-colors hover:bg-accent",
                  d.occupied ? "border-t-primary bg-primary-soft text-primary" : "border-t-border bg-surface text-muted-foreground",
                  highlight && !highlight.has(d.code) && "opacity-20"
                )}
              >
                {d.occupied ? <Truck className="size-3.5" /> : <span className="size-3.5" />}
                <span className="font-mono">D{d.rack}</span>
              </button>
            </Hint>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[72px_1fr_72px] gap-3">
        {recv.length ? <Staging code="R" title="Receiving" /> : <div />}
        <div className="space-y-3">
          <div className="grid gap-3 xl:grid-cols-2">
            {z("A") && <RackZone zone={z("A")!} locs={byZone("A")} onSelect={onSelect} highlight={highlight} />}
            <div className="space-y-3">
              {z("B") && <RackZone zone={z("B")!} locs={byZone("B")} onSelect={onSelect} highlight={highlight} />}
              {z("D") && <RackZone zone={z("D")!} locs={byZone("D")} onSelect={onSelect} highlight={highlight} />}
            </div>
          </div>
          {z("C") && (
            <div className="rounded-md border bg-subtle/60 p-3">
              <ZoneLabel zone={z("C")!} pct={(bulk.reduce((s, l) => s + l.occupied, 0) / (bulk.reduce((s, l) => s + l.capacity, 0) || 1)) * 100} count={bulk.length} />
              <div className="flex gap-1.5">
                {bulk.map((l) => (
                  <Cell key={l.id} l={l} onSelect={onSelect} highlight={highlight} className="flex h-10 flex-1 items-end justify-center pb-1">
                    <span className={cn("font-mono text-[9px]", l.occupied / l.capacity > 0.75 ? "text-white" : "text-muted-foreground")}>L{l.rack}</span>
                  </Cell>
                ))}
              </div>
            </div>
          )}
        </div>
        {ship.length ? <Staging code="S" title="Shipping" /> : <div />}
      </div>
    </div>
  );
}

export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted-foreground">
      <span className="font-medium text-foreground">Occupancy</span>
      <span className="flex items-center gap-0.5">
        {RAMP.map((r) => (
          <span key={r.label} title={r.label} className={cn("h-3 w-5 border border-black/[0.06] first:rounded-l last:rounded-r", r.cls)} />
        ))}
      </span>
      <span>0% → 90%+</span>
      <span className="flex items-center gap-1.5">
        <span className="bg-hatch size-3 rounded-[2px] border border-danger/40 bg-danger-soft" /> Blocked
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[2px] border border-warning/50 bg-warning-soft" /> Maintenance
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[2px] ring-2 ring-[#eb6834] ring-offset-1" /> Search match
      </span>
    </div>
  );
}
