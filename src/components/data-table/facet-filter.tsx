"use client";

import * as React from "react";
import type { Column } from "@tanstack/react-table";
import { Check, PlusCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface FacetOption {
  label: string;
  value: string;
  icon?: React.ElementType;
}

export function FacetFilter<T>({ column, title, options }: { column: Column<T, unknown>; title: string; options: FacetOption[] }) {
  const facets = column.getFacetedUniqueValues();
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);
  const [q, setQ] = React.useState("");
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    column.setFilterValue(next.size ? [...next] : undefined);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <PlusCircle className="text-muted-foreground" />
          {title}
          {selected.size > 0 && (
            <>
              <Separator orientation="vertical" className="mx-0.5 h-4" />
              {selected.size > 2 ? (
                <span className="rounded bg-primary-soft px-1 text-2xs text-primary">{selected.size} selected</span>
              ) : (
                options
                  .filter((o) => selected.has(o.value))
                  .map((o) => (
                    <span key={o.value} className="rounded bg-primary-soft px-1 text-2xs text-primary">
                      {o.label}
                    </span>
                  ))
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        {options.length > 7 && (
          <div className="border-b p-1.5">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filter ${title.toLowerCase()}…`} className="h-7 w-full rounded px-2 text-[13px] outline-none" />
          </div>
        )}
        <div className="scrollbar-thin max-h-64 overflow-y-auto p-1">
          {shown.map((o) => {
            const isSel = selected.has(o.value);
            const Icon = o.icon;
            return (
              <button key={o.value} onClick={() => toggle(o.value)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                <span className={cn("flex size-4 items-center justify-center rounded-[4px] border", isSel ? "border-primary bg-primary text-white" : "border-input")}>
                  {isSel && <Check className="size-3" strokeWidth={3} />}
                </span>
                {Icon && <Icon className="size-3.5 text-muted-foreground" />}
                <span className="flex-1 truncate">{o.label}</span>
                <span className="font-mono text-2xs text-muted-foreground">{facets.get(o.value) ?? 0}</span>
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <div className="border-t p-1">
            <button onClick={() => column.setFilterValue(undefined)} className="w-full rounded px-2 py-1.5 text-center text-xs hover:bg-accent">
              Clear filters
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
