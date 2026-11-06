"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { InventoryDrawer } from "./inventory-drawer";
import { useInitialParam } from "@/hooks/use-query-flag";
import { STOCK_STATUS } from "@/lib/status";
import { formatCurrency, formatNumber, formatRelative } from "@/lib/format";
import { CATEGORIES, type InventoryRecord, type StockStatus } from "@/types";
import { cn } from "@/lib/utils";

type Row = InventoryRecord & { zone: string };

export function InventoryView() {
  const { inventory, products, warehouse, actions } = useWms();
  const q = useInitialParam("q");
  const status = useInitialParam("status");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StockStatus | null>((status as StockStatus) ?? null);

  const cost = React.useMemo(() => new Map(products.map((p) => [p.id, p.unitCost])), [products]);
  const rows = React.useMemo<Row[]>(() => inventory.map((r) => ({ ...r, zone: r.locationCode.split("-")[1] })), [inventory]);
  const data = React.useMemo(() => (statusFilter ? rows.filter((r) => (statusFilter === "low_stock" ? r.status === "low_stock" || r.status === "out_of_stock" : r.status === statusFilter)) : rows), [rows, statusFilter]);

  const summary = React.useMemo(() => {
    const bySku = new Map<string, StockStatus>();
    rows.forEach((r) => bySku.set(r.productId, r.status));
    const count = (s: StockStatus) => [...bySku.values()].filter((x) => x === s).length;
    return {
      total: rows.reduce((s, r) => s + r.total, 0),
      available: rows.reduce((s, r) => s + r.available, 0),
      reserved: rows.reduce((s, r) => s + r.reserved, 0),
      value: rows.reduce((s, r) => s + r.total * (cost.get(r.productId) ?? 0), 0),
      counts: { in_stock: count("in_stock"), low_stock: count("low_stock"), out_of_stock: count("out_of_stock"), overstock: count("overstock") } as Record<StockStatus, number>,
    };
  }, [rows, cost]);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      {
        accessorKey: "sku",
        header: "SKU",
        meta: { label: "SKU" },
        cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.sku}</span>,
      },
      {
        accessorKey: "productName",
        header: "Product",
        meta: { label: "Product" },
        cell: ({ row }) => (
          <div className="flex max-w-[300px] items-center gap-2.5">
            <ProductThumb category={row.original.category} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium">{row.original.productName}</div>
              <div className="font-mono text-2xs text-muted-foreground">Lot {row.original.lot}</div>
            </div>
          </div>
        ),
      },
      { accessorKey: "category", header: "Category", meta: { label: "Category" }, filterFn: inArrayFilter, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
      {
        accessorKey: "locationCode",
        header: "Location",
        meta: { label: "Location" },
        cell: ({ getValue }) => <span className="rounded border bg-subtle px-1.5 py-0.5 font-mono text-2xs">{getValue() as string}</span>,
      },
      { accessorKey: "zone", header: "Zone", meta: { label: "Zone" }, filterFn: inArrayFilter, enableHiding: true },
      { accessorKey: "available", header: "Available", meta: { align: "right", label: "Available" }, cell: ({ getValue }) => <span className="font-medium">{formatNumber(getValue() as number)}</span> },
      { accessorKey: "reserved", header: "Reserved", meta: { align: "right", label: "Reserved" }, cell: ({ getValue }) => <span className="text-muted-foreground">{formatNumber(getValue() as number)}</span> },
      { accessorKey: "total", header: "Total", meta: { align: "right", label: "Total" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
      { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={STOCK_STATUS} value={row.original.status} /> },
      { accessorKey: "updatedAt", header: "Last updated", meta: { label: "Last updated" }, cell: ({ getValue }) => <span className="text-muted-foreground">{formatRelative(getValue() as string)}</span> },
    ],
    []
  );

  const scheduleCount = (items: Row[]) => {
    const locs = new Set(items.map((r) => r.locationCode));
    actions.log({ module: "Inventory", action: "Cycle count scheduled", entity: `${locs.size} locations`, details: [...locs].slice(0, 3).join(", ") + (locs.size > 3 ? "…" : ""), severity: "info" });
    toast.success("Cycle count scheduled", { description: `${locs.size} location${locs.size === 1 ? "" : "s"} added to tonight's count plan` });
  };

  const chips: { key: StockStatus; label: string }[] = [
    { key: "in_stock", label: "In stock" },
    { key: "low_stock", label: "Low / out" },
    { key: "out_of_stock", label: "Out of stock" },
    { key: "overstock", label: "Overstock" },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory"
        description={`Stock on hand by SKU and location at ${warehouse.name}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => scheduleCount(data)}>
              <ClipboardCheck /> Cycle count
            </Button>
            <Button asChild>
              <Link href="/adjustments?new=1">
                <SlidersHorizontal /> Adjust stock
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4 xl:grid-cols-8">
        {[
          ["Units on hand", formatNumber(summary.total)],
          ["Available", formatNumber(summary.available)],
          ["Reserved", formatNumber(summary.reserved)],
          ["Inventory value", formatCurrency(summary.value)],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-base font-semibold tabular">{v}</div>
          </div>
        ))}
        {chips.map((c) => {
          const n = c.key === "low_stock" ? summary.counts.low_stock + summary.counts.out_of_stock : summary.counts[c.key];
          const active = statusFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setStatusFilter(active ? null : c.key)}
              className={cn("bg-surface px-4 py-3 text-left transition-colors hover:bg-subtle", active && "bg-primary-soft hover:bg-primary-soft")}
            >
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <span className={cn("size-1.5 rounded-full", c.key === "in_stock" ? "bg-success" : c.key === "low_stock" ? "bg-warning" : c.key === "out_of_stock" ? "bg-danger" : "bg-violet-500")} />
                {c.label}
              </div>
              <div className="mt-0.5 text-base font-semibold tabular">
                {n} <span className="text-2xs font-normal text-muted-foreground">SKUs</span>
              </div>
            </button>
          );
        })}
      </div>

      <DataTable
        key={warehouse.id}
        columns={columns}
        data={data}
        searchPlaceholder="Search SKU, product, lot or location…"
        searchText={(r) => `${r.sku} ${r.productName} ${r.lot} ${r.locationCode} ${r.category}`}
        initialSearch={q ?? ""}
        initialVisibility={{ zone: false }}
        initialSorting={[{ id: "sku", desc: false }]}
        facets={[
          { columnId: "category", title: "Category", options: CATEGORIES.map((c) => ({ label: c, value: c })) },
          { columnId: "zone", title: "Zone", options: [...new Set(rows.map((r) => r.zone))].sort().map((z) => ({ label: `Zone ${z === "LANE" ? "C" : z}`, value: z })) },
          { columnId: "status", title: "Status", options: Object.entries(STOCK_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        onRowClick={(r) => setSelected(r.productId)}
        getRowId={(r) => r.id}
        selectable
        bulkActions={(sel, clear) => (
          <>
            <Button size="sm" variant="secondary" onClick={() => { scheduleCount(sel); clear(); }}>
              <ClipboardCheck /> Schedule count
            </Button>
          </>
        )}
        exportName={`inventory-${warehouse.id}`}
        exportRow={(r) => ({ sku: r.sku, product: r.productName, category: r.category, location: r.locationCode, lot: r.lot, available: r.available, reserved: r.reserved, total: r.total, status: STOCK_STATUS[r.status].label, updated: r.updatedAt })}
        rowClassName={(r) => (r.status === "out_of_stock" ? "bg-danger-soft/30" : undefined)}
        pageSize={15}
      />

      <InventoryDrawer productId={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}
