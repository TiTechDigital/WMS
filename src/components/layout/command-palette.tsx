"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, ClipboardList, CornerDownLeft, MapPin, Package, PackageOpen, Search } from "lucide-react";
import { ALL_NAV_ITEMS } from "@/lib/navigation";
import { useWms } from "@/store/wms-store";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { ORDER_STATUS, INBOUND_STATUS } from "@/lib/status";
import { Badge } from "@/components/ui/badge";

type Result = { id: string; group: string; title: string; subtitle?: string; href: string; icon: React.ElementType; meta?: React.ReactNode };

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter();
  const { products, orders, inbound, locations } = useWms();
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const results = React.useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const pages: Result[] = ALL_NAV_ITEMS.filter((i) => !term || i.title.toLowerCase().includes(term) || i.description.toLowerCase().includes(term)).map((i) => ({
      id: i.href,
      group: "Navigate",
      title: i.title,
      subtitle: i.description,
      href: i.href,
      icon: i.icon,
    }));
    if (!term) return pages.slice(0, 8);
    const prod: Result[] = products
      .filter((p) => p.sku.toLowerCase().includes(term) || p.name.toLowerCase().includes(term) || p.barcode.includes(term))
      .slice(0, 6)
      .map((p) => ({ id: p.id, group: "Products", title: p.name, subtitle: `${p.sku} · ${p.barcode}`, href: `/inventory?q=${encodeURIComponent(p.sku)}`, icon: Package }));
    const ord: Result[] = orders
      .filter((o) => o.id.toLowerCase().includes(term) || o.customerName.toLowerCase().includes(term))
      .slice(0, 5)
      .map((o) => ({
        id: o.id,
        group: "Orders",
        title: o.id,
        subtitle: o.customerName,
        href: `/orders?id=${o.id}`,
        icon: ClipboardList,
        meta: <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge>,
      }));
    const asn: Result[] = inbound
      .filter((s) => s.id.toLowerCase().includes(term) || s.poNumber.toLowerCase().includes(term) || s.supplierName.toLowerCase().includes(term))
      .slice(0, 4)
      .map((s) => ({
        id: s.id,
        group: "Inbound",
        title: `${s.id} · ${s.poNumber}`,
        subtitle: s.supplierName,
        href: `/inbound?id=${s.id}`,
        icon: PackageOpen,
        meta: <Badge tone={INBOUND_STATUS[s.status].tone}>{INBOUND_STATUS[s.status].label}</Badge>,
      }));
    const loc: Result[] = locations
      .filter((l) => l.code.toLowerCase().includes(term))
      .slice(0, 4)
      .map((l) => ({ id: l.id, group: "Locations", title: l.code, subtitle: `${l.occupied}/${l.capacity} units`, href: `/locations?q=${encodeURIComponent(l.code)}`, icon: MapPin }));
    return [...pages.slice(0, 4), ...prod, ...ord, ...asn, ...loc];
  }, [q, products, orders, inbound, locations]);

  React.useEffect(() => setActive(0), [q]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (r: Result) => {
    onOpenChange(false);
    router.push(r.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      go(results[active]);
    }
  };

  const groups = results.reduce<Record<string, { r: Result; i: number }[]>>((acc, r, i) => {
    (acc[r.group] ??= []).push({ r, i });
    return acc;
  }, {});

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-950/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border bg-surface shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search pages, SKUs, orders, shipments and locations</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search SKUs, orders, ASNs, locations or pages…"
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Kbd>ESC</Kbd>
          </div>
          <div ref={listRef} className="scrollbar-thin max-h-[400px] overflow-y-auto p-1.5">
            {results.length === 0 && <div className="px-3 py-10 text-center text-sm text-muted-foreground">No results for “{q}”.</div>}
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
                {items.map(({ r, i }) => {
                  const Icon = r.icon;
                  return (
                    <button
                      key={r.group + r.id}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left", i === active ? "bg-accent" : "")}
                    >
                      <span className="flex size-7 shrink-0 items-center justify-center rounded border bg-surface text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{r.title}</span>
                        {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                      </span>
                      {r.meta}
                      {i === active && <ArrowRight className="size-3.5 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 border-t bg-subtle px-3 py-2 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
            <span className="flex items-center gap-1"><Kbd><CornerDownLeft className="size-3" /></Kbd> open</span>
            <span className="ml-auto">Scanner input supported — scan a barcode to look it up</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
