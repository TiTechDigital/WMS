"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductThumb } from "./product-thumb";
import { cn } from "@/lib/utils";
import type { Product } from "@/types";
import { useFieldControlProps } from "@/components/ui/field-context";

/** Searchable product combobox (by name, SKU or barcode — scanner friendly). */
export function SkuPicker({ products, value, onChange, placeholder = "Select SKU…", className }: { products: Product[]; value?: string; onChange: (p: Product) => void; placeholder?: string; className?: string }) {
  const fieldProps = useFieldControlProps({});
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const selected = products.find((p) => p.id === value);
  const list = products.filter((p) => !q || `${p.sku} ${p.name} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())).slice(0, 50);
  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <button type="button" {...fieldProps} className={cn("flex h-8 w-full items-center gap-2 rounded-md border border-input bg-surface px-2.5 text-left text-[13px] shadow-card", className)}>
          {selected ? (
            <>
              <span className="font-mono text-xs">{selected.sku}</span>
              <span className="truncate text-muted-foreground">{selected.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
        <div className="flex items-center gap-2 border-b px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && list[0]) {
                e.preventDefault();
                onChange(list[0]);
                setOpen(false);
              }
            }}
            placeholder="Search or scan barcode…"
            className="h-9 flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
        <div className="scrollbar-thin max-h-64 overflow-y-auto p-1">
          {list.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
            >
              <ProductThumb category={p.category} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px]">{p.name}</span>
                <span className="block font-mono text-2xs text-muted-foreground">{p.sku}</span>
              </span>
              {p.id === value && <Check className="size-3.5 text-primary" />}
            </button>
          ))}
          {list.length === 0 && <div className="py-6 text-center text-xs text-muted-foreground">No products found</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
