"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, LayoutGrid, MoreHorizontal, Pencil, Plus, Rows3, Archive, Eye } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProductThumb } from "@/components/shared/product-thumb";
import { Input } from "@/components/ui/input";
import { ProductFormDialog } from "./product-form";
import { InventoryDrawer } from "../inventory/inventory-drawer";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { PRODUCT_STATUS, STOCK_STATUS } from "@/lib/status";
import { formatCurrency, formatNumber } from "@/lib/format";
import { CATEGORIES, type Product, type StockStatus } from "@/types";
import { useLocalStorage } from "@/hooks/use-local-storage";

type Row = Product & { supplierName: string; onHand: number; stock?: StockStatus };

export function ProductsView() {
  const { products, suppliers, inventory, actions, can } = useWms();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | undefined>();
  const [viewing, setViewing] = React.useState<string | null>(null);
  const [view, setView] = useLocalStorage<"table" | "grid">("wms.products.view", "table");
  const [gridQuery, setGridQuery] = React.useState("");

  const openCreate = React.useCallback(() => {
    setEditing(undefined);
    setFormOpen(true);
  }, []);
  const openEdit = React.useCallback((p: Product) => {
    setEditing(p);
    setFormOpen(true);
  }, []);
  useQueryFlag("new", openCreate);
  useQueryFlag("edit", (id) => {
    const p = products.find((x) => x.id === id);
    if (p) {
      setViewing(null);
      openEdit(p);
    }
  });

  const supplierName = React.useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);
  const rows = React.useMemo<Row[]>(() => {
    const onHand = new Map<string, number>();
    const st = new Map<string, StockStatus>();
    inventory.forEach((r) => {
      onHand.set(r.productId, (onHand.get(r.productId) ?? 0) + r.total);
      st.set(r.productId, r.status);
    });
    return products.map((p) => ({ ...p, supplierName: supplierName.get(p.supplierId) ?? "—", onHand: onHand.get(p.id) ?? 0, stock: st.get(p.id) }));
  }, [products, inventory, supplierName]);

  const canManage = can("products.manage");
  const duplicate = async (p: Product) => {
    const copy: Product = { ...p, sku: `${p.sku}-CP`.slice(0, 40), name: `${p.name} (copy)`, status: "draft" };
    if (await actions.upsertProduct(copy, true)) toast.success("Product duplicated as draft", { description: copy.sku });
  };
  const toggleArchive = async (p: Product) => {
    const status = p.status === "discontinued" ? "active" : "discontinued";
    if (!(await actions.upsertProduct({ ...p, status }, false))) return;
    toast.success(status === "discontinued" ? "Product discontinued" : "Product reactivated", { description: p.sku });
  };

  const RowMenu = ({ p }: { p: Product }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()} aria-label="Row actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setViewing(p.id)}>
          <Eye /> View stock
        </DropdownMenuItem>
        {canManage && (
          <DropdownMenuItem onSelect={() => openEdit(p)}>
            <Pencil /> Edit
          </DropdownMenuItem>
        )}
        {canManage && (
          <>
            <DropdownMenuItem onSelect={() => duplicate(p)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive={p.status !== "discontinued"} onSelect={() => toggleArchive(p)}>
              <Archive /> {p.status === "discontinued" ? "Reactivate" : "Discontinue"}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Product",
      meta: { label: "Product" },
      cell: ({ row }) => (
        <div className="flex max-w-[320px] items-center gap-2.5">
          <ProductThumb category={row.original.category} imageUrl={row.original.imageUrl} />
          <div className="min-w-0">
            <div className="truncate font-medium">{row.original.name}</div>
            <div className="truncate text-2xs text-muted-foreground">{row.original.brand}</div>
          </div>
        </div>
      ),
    },
    { accessorKey: "sku", header: "SKU", meta: { label: "SKU" }, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "barcode", header: "Barcode", meta: { label: "Barcode" }, cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "category", header: "Category", meta: { label: "Category" }, filterFn: inArrayFilter },
    { accessorKey: "uom", header: "UoM", meta: { label: "UoM" }, cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: "weightKg", header: "Weight", meta: { align: "right", label: "Weight" }, cell: ({ getValue }) => `${getValue()} kg` },
    {
      id: "dims",
      header: "Dimensions",
      meta: { label: "Dimensions" },
      accessorFn: (r) => r.dimensions.length * r.dimensions.width * r.dimensions.height,
      cell: ({ row }) => <span className="tabular text-muted-foreground">{row.original.dimensions.length}×{row.original.dimensions.width}×{row.original.dimensions.height} cm</span>,
    },
    { id: "minmax", header: "Min / Max", meta: { align: "right", label: "Min / Max" }, accessorFn: (r) => r.minStock, cell: ({ row }) => <span className="tabular">{formatNumber(row.original.minStock)} / {formatNumber(row.original.maxStock)}</span> },
    { accessorKey: "onHand", header: "On hand", meta: { align: "right", label: "On hand" }, cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        {row.original.stock && row.original.stock !== "in_stock" && <span className={`size-1.5 rounded-full ${row.original.stock === "overstock" ? "bg-violet-500" : row.original.stock === "out_of_stock" ? "bg-danger" : "bg-warning"}`} title={STOCK_STATUS[row.original.stock].label} />}
        {formatNumber(row.original.onHand)}
      </span>
    ) },
    { accessorKey: "supplierName", header: "Supplier", meta: { label: "Supplier" }, filterFn: inArrayFilter, cell: ({ getValue }) => <span className="block max-w-[160px] truncate text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "unitCost", header: "Unit cost", meta: { align: "right", label: "Unit cost" }, cell: ({ getValue }) => formatCurrency(getValue() as number, true) },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={PRODUCT_STATUS} value={row.original.status} /> },
    { id: "actions", header: "", enableSorting: false, enableHiding: false, size: 40, cell: ({ row }) => <RowMenu p={row.original} /> },
  ];

  const gridRows = rows.filter((r) => !gridQuery || `${r.name} ${r.sku} ${r.barcode} ${r.brand}`.toLowerCase().includes(gridQuery.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products / SKU Catalog"
        description={`${products.length} SKUs · ${products.filter((p) => p.status === "active").length} active · ${suppliers.length} suppliers`}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "table" | "grid")}>
              <TabsList variant="segmented">
                <TabsTrigger value="table" aria-label="Table view">
                  <Rows3 /> Table
                </TabsTrigger>
                <TabsTrigger value="grid" aria-label="Grid view">
                  <LayoutGrid /> Grid
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {canManage && (
              <Button onClick={openCreate}>
                <Plus /> Add product
              </Button>
            )}
          </>
        }
      />

      {view === "table" ? (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search name, SKU, barcode or brand…"
          searchText={(r) => `${r.name} ${r.sku} ${r.barcode} ${r.brand} ${r.supplierName}`}
          facets={[
            { columnId: "category", title: "Category", options: CATEGORIES.map((c) => ({ label: c, value: c })) },
            { columnId: "supplierName", title: "Supplier", options: suppliers.map((s) => ({ label: s.name, value: s.name })) },
            { columnId: "status", title: "Status", options: Object.entries(PRODUCT_STATUS).map(([value, m]) => ({ label: m.label, value })) },
          ]}
          initialVisibility={{ barcode: false, weightKg: false }}
          onRowClick={(r) => setViewing(r.id)}
          getRowId={(r) => r.id}
          exportName="product-catalog"
          exportRow={(r) => ({ sku: r.sku, name: r.name, barcode: r.barcode, category: r.category, brand: r.brand, uom: r.uom, weight_kg: r.weightKg, length_cm: r.dimensions.length, width_cm: r.dimensions.width, height_cm: r.dimensions.height, min_stock: r.minStock, max_stock: r.maxStock, supplier: r.supplierName, unit_cost: r.unitCost, status: r.status })}
        />
      ) : (
        <div className="space-y-3">
          <Input type="search" aria-label="Search products" value={gridQuery} onChange={(e) => setGridQuery(e.target.value)} placeholder="Search products…" className="max-w-xs" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {gridRows.map((p) => (
              <div key={p.id} role="button" tabIndex={0} onClick={() => setViewing(p.id)} onKeyDown={(e) => e.key === "Enter" && setViewing(p.id)} className="group cursor-pointer rounded-lg border bg-surface p-3 shadow-card transition-colors hover:border-primary/30">
                <div className="relative">
                  <ProductThumb category={p.category} imageUrl={p.imageUrl} size="xl" className="rounded-md" />
                  <div className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <RowMenu p={p} />
                  </div>
                  <div className="absolute left-1.5 top-1.5">
                    <StatusBadge map={PRODUCT_STATUS} value={p.status} dot={false} />
                  </div>
                </div>
                <div className="mt-2.5 truncate text-[13px] font-medium">{p.name}</div>
                <div className="font-mono text-2xs text-muted-foreground">{p.sku}</div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{p.category}</span>
                  <span className="font-medium tabular">{formatNumber(p.onHand)} {p.uom}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <ProductFormDialog open={formOpen} onOpenChange={setFormOpen} product={editing} />
      <InventoryDrawer productId={viewing} onOpenChange={(o) => !o && setViewing(null)} />
    </div>
  );
}
