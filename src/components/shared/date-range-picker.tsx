"use client";

import * as React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentTime } from "@/lib/constants";
import { formatDate, toISODate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DateRange = { from: string; to: string; preset: string };

const DAY = 86400000;
const today = toISODate(currentTime());
const daysAgo = (n: number) => toISODate(new Date(currentTime().getTime() - n * DAY));

export const DATE_PRESETS: { id: string; label: string; range: () => [string, string] }[] = [
  { id: "today", label: "Today", range: () => [today, today] },
  { id: "7d", label: "Last 7 days", range: () => [daysAgo(6), today] },
  { id: "14d", label: "Last 14 days", range: () => [daysAgo(13), today] },
  { id: "30d", label: "Last 30 days", range: () => [daysAgo(29), today] },
  { id: "90d", label: "Last 90 days", range: () => [daysAgo(89), today] },
  { id: "qtd", label: "Quarter to date", range: () => [`${currentTime().getUTCFullYear()}-10-01`, today] },
  { id: "180d", label: "Last 6 months", range: () => [daysAgo(179), today] },
];

export function presetRange(id: string): DateRange {
  const p = DATE_PRESETS.find((x) => x.id === id) ?? DATE_PRESETS[3];
  const [from, to] = p.range();
  return { from, to, preset: p.id };
}

export function DateRangePicker({ value, onChange, className, align = "end" }: { value: DateRange; onChange: (r: DateRange) => void; className?: string; align?: "start" | "end" }) {
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(value.from);
  const [to, setTo] = React.useState(value.to);
  React.useEffect(() => {
    setFrom(value.from);
    setTo(value.to);
  }, [value.from, value.to, open]);
  const preset = DATE_PRESETS.find((p) => p.id === value.preset);
  const label = preset ? preset.label : `${formatDate(value.from + "T00:00:00Z")} – ${formatDate(value.to + "T00:00:00Z")}`;
  const invalid = !from || !to || from > to;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" className={cn("justify-start", className)}>
          <CalendarDays className="text-muted-foreground" />
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-1 !size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="flex w-auto gap-0 p-0">
        <div className="flex w-40 flex-col border-r p-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(presetRange(p.id));
                setOpen(false);
              }}
              className={cn("rounded px-2 py-1.5 text-left text-[13px] hover:bg-accent", value.preset === p.id && "bg-primary-soft font-medium text-primary")}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="w-56 p-3">
          <div className="mb-2 text-xs font-semibold">Custom range</div>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="dr-from" className="text-2xs text-muted-foreground">From</Label>
              <Input id="dr-from" type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dr-to" className="text-2xs text-muted-foreground">To</Label>
              <Input id="dr-to" type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          {invalid && <p className="mt-2 text-2xs text-danger-text">Start date must be before end date.</p>}
          <Button
            className="mt-3 w-full"
            size="sm"
            disabled={invalid}
            onClick={() => {
              onChange({ from, to, preset: "custom" });
              setOpen(false);
            }}
          >
            Apply range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function inRange(isoDate: string, r: DateRange) {
  const d = isoDate.slice(0, 10);
  return d >= r.from && d <= r.to;
}
