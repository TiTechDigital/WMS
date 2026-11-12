"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Ban, Check, MoreHorizontal, Plus, Truck } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/form-field";
import { SkuPicker } from "@/components/shared/sku-picker";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { TRANSFER_STATUS } from "@/lib/status";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import type { Product, StockTransfer } from "@/types";

const TYPE_LABEL: Record<StockTransfer["type"], string> = { replenishment: "Replenishment", internal: "Internal move", "inter-warehouse": "Inter-warehouse" };
type Row = StockTransfer & { qty: number; sku: string };

export function TransfersView() {
  const { transfers, warehouse, actions } = useWms();
  const [open, setOpen] = React.useState(false);
  const [presetSku, setPresetSku] = React.useState<string | undefined>();
  const { confirm, dialog } = useConfirm();
  useQueryFlag("sku", setPresetSku);
  useQueryFlag("new", () => setOpen(true));

  const rows = React.useMemo<Row[]>(() => transfers.map((t) => ({ ...t, qty: t.lines.reduce((s, l) => s + l.quantity, 0), sku: t.lines[0]?.sku ?? "" })), [transfers]);
  const step = async (t: Row, status: "requested" | "in_transit" | "completed" | "cancelled") => {
    if (!(await actions.setTransferStatus(t.id, status))) return;
    toast.success(`${t.id} → ${TRANSFER_STATUS[status].label}`, { description: status === "completed" ? "Stock moved between locations" : undefined });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "id", header: "Transfer", meta: { label: "Transfer" }, cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span> },
    { accessorKey: "type", header: "Type", meta: { label: "Type" }, filterFn: inArrayFilter, cell: ({ row }) => <Badge tone={row.original.type === "replenishment" ? "primary" : row.original.type === "inter-warehouse" ? "violet" : "neutral"}>{TYPE_LABEL[row.original.type]}</Badge> },
    {
      accessorKey: "sku",
      header: "Product",
      meta: { label: "Product" },
      cell: ({ row }) => (
        <div className="max-w-[230px]">
          <div className="truncate">{row.original.lines[0]?.productName}</div>
          <div className="font-mono text-2xs text-muted-foreground">
            {row.original.sku}
            {row.original.lines.length > 1 && ` +${row.original.lines.length - 1} more`}
          </div>
        </div>
      ),
    },
    {
      id: "route",
      header: "From → To",
      meta: { label: "Route" },
      accessorFn: (r) => r.fromLocation,
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5 font-mono text-2xs">
          <span className="rounded border bg-subtle px-1.5 py-0.5">{row.original.fromLocation}</span>
          <ArrowRight className="size-3 text-muted-foreground" />
          <span className="rounded border bg-subtle px-1.5 py-0.5">{row.original.toLocation}</span>
        </span>
      ),
    },
    { accessorKey: "qty", header: "Qty", meta: { align: "right", label: "Qty" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
    { accessorKey: "reason", header: "Reason", meta: { label: "Reason" }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "requestedBy", header: "Requested by", meta: { label: "Requested by" } },
    { accessorKey: "assignedTo", header: "Operator", meta: { label: "Operator" }, cell: ({ getValue }) => (getValue() as string) ?? <span className="text-muted-foreground">—</span> },
    { accessorKey: "createdAt", header: "Created", meta: { label: "Created" }, cell: ({ getValue }) => <span className="text-muted-foreground">{formatRelative(getValue() as string)}</span> },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={TRANSFER_STATUS} value={row.original.status} /> },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const t = row.original;
        if (t.status === "completed" || t.status === "cancelled") return <span className="text-2xs text-muted-foreground">{t.completedAt ? formatDateTime(t.completedAt) : ""}</span>;
        return (
          <div className="flex items-center justify-end gap-1">
            {t.status === "in_transit" ? (
              <Button size="sm" variant="secondary" onClick={() => step(t, "completed")}>
                <Check /> Complete
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => step(t, t.status === "draft" ? "requested" : "in_transit")}>
                {t.status === "draft" ? "Submit" : <><Truck /> Dispatch</>}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${t.id}`}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  destructive
                  onSelect={() =>
                    confirm({
                      title: `Cancel ${t.id}?`,
                      description: `${t.qty} units of ${t.sku} stay at ${t.fromLocation}. Any operator task for this move is withdrawn.`,
                      confirmLabel: "Cancel transfer",
                      tone: "danger",
                      onConfirm: () => step(t, "cancelled"),
                    })
                  }
                >
                  <Ban /> Cancel transfer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];

  const open_ = rows.filter((r) => r.status === "requested" || r.status === "in_transit");
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Transfers"
        description={`Replenishment, internal moves and inter-site rebalancing · ${warehouse.name}`}
        actions={
          <Button
            onClick={() => {
              setPresetSku(undefined);
              setOpen(true);
            }}
          >
            <Plus /> New transfer
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Open transfers", open_.length],
          ["In transit", rows.filter((r) => r.status === "in_transit").length],
          ["Units moving", formatNumber(open_.reduce((s, r) => s + r.qty, 0))],
          ["Completed (all time)", rows.filter((r) => r.status === "completed").length],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
      <DataTable
        key={warehouse.id}
        columns={columns}
        data={rows}
        searchPlaceholder="Search transfer, SKU, location…"
        searchText={(r) => `${r.id} ${r.lines.map((l) => `${l.sku} ${l.productName}`).join(" ")} ${r.fromLocation} ${r.toLocation} ${r.requestedBy}`}
        facets={[
          { columnId: "type", title: "Type", options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ label, value })) },
          { columnId: "status", title: "Status", options: Object.entries(TRANSFER_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        initialVisibility={{ reason: false, requestedBy: false }}
        getRowId={(r) => r.id}
        exportName={`transfers-${warehouse.id}`}
        exportRow={(r) => ({ transfer: r.id, type: r.type, sku: r.sku, from: r.fromLocation, to: r.toLocation, qty: r.qty, reason: r.reason, requested_by: r.requestedBy, status: r.status, created: r.createdAt })}
      />
      <NewTransferDialog open={open} onOpenChange={setOpen} presetSku={presetSku} />
      {dialog}
    </div>
  );
}

function NewTransferDialog({ open, onOpenChange, presetSku }: { open: boolean; onOpenChange: (v: boolean) => void; presetSku?: string }) {
  const { products, inventory, locations, warehouse, warehouses, actions } = useWms();
  const otherSites = warehouses.filter((w) => w.id !== warehouse.id);
  const [saving, setSaving] = React.useState(false);
  const [type, setType] = React.useState<StockTransfer["type"]>("internal");
  const [product, setProduct] = React.useState<Product | undefined>();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [toWh, setToWh] = React.useState("");
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const stocked = React.useMemo(() => {
    const ids = new Set(inventory.filter((r) => r.available > 0).map((r) => r.productId));
    return products.filter((p) => ids.has(p.id));
  }, [inventory, products]);

  React.useEffect(() => {
    if (!open) return;
    const p = presetSku ? stocked.find((x) => x.sku === presetSku) : undefined;
    setType("internal");
    setProduct(p);
    setFrom("");
    setTo("");
    setToWh(otherSites[0]?.id ?? "");
    setQty("");
    setReason("");
    setError(null);
  }, [open, presetSku, stocked, warehouse.id]);

  const sources = product ? inventory.filter((r) => r.productId === product.id && r.available > 0) : [];
  const src = sources.find((r) => r.locationCode === from);
  const freeLocs = locations.filter((l) => (l.type === "pick-bin" || l.type === "pallet" || l.type === "cold" || l.type === "bulk") && l.status === "active" && l.code !== from);
  const suggested = product ? inventory.filter((r) => r.productId === product.id && r.locationCode !== from).map((r) => r.locationCode) : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return setError("Select a product.");
    if (!src) return setError("Select a source location.");
    if (type === "inter-warehouse" && !toWh) return setError("No other site is available for an inter-warehouse transfer.");
    const destination = type === "inter-warehouse" ? `${toWh.replace(/^WH-/, "")}-R-STG-01` : to;
    if (!destination) return setError("Select a destination location.");
    const n = Number(qty);
    if (!(n > 0)) return setError("Enter a quantity.");
    if (n > src.available) return setError(`Only ${src.available} units available at ${src.locationCode}.`);
    setSaving(true);
    const res = await actions.createTransfer({
      type,
      fromLocation: src.locationCode,
      toLocation: destination,
      productId: product.id,
      quantity: n,
      reason: reason.trim() || (type === "replenishment" ? "Pick face below min" : type === "inter-warehouse" ? "Rebalance network stock" : "Slotting optimisation"),
    });
    setSaving(false);
    if (!res) return;
    toast.success(`${res.id} requested`, { description: `${n} × ${product.sku} · ${src.locationCode} → ${destination}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New stock transfer</DialogTitle>
            <DialogDescription>Move stock between locations or sites. A task is sent to forklift operators.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TYPE_LABEL) as StockTransfer["type"][]).map((k) => (
                <button type="button" key={k} onClick={() => setType(k)} className={`rounded-md border px-3 py-2 text-left text-xs transition-colors ${type === k ? "border-primary bg-primary-soft text-primary" : "hover:bg-accent"}`}>
                  <div className="font-medium">{TYPE_LABEL[k]}</div>
                  <div className="text-2xs text-muted-foreground">{k === "replenishment" ? "Reserve → pick face" : k === "internal" ? "Re-slot within site" : "Ship to another DC"}</div>
                </button>
              ))}
            </div>
            <Field label="Product" required>
              <SkuPicker products={stocked} value={product?.id} onChange={(p) => { setProduct(p); setFrom(""); }} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From location" required hint={src ? `${src.available} available · lot ${src.lot}` : undefined}>
                <Select value={from} onValueChange={setFrom} disabled={!product}>
                  <SelectTrigger>
                    <SelectValue placeholder={product ? "Select source" : "Select product first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((r) => (
                      <SelectItem key={r.id} value={r.locationCode}>
                        {r.locationCode} · {r.available} avail.
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {type === "inter-warehouse" ? (
                <Field label="Destination site" required>
                  <Select value={toWh} onValueChange={setToWh}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {otherSites.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <Field label="To location" required>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination" />
                    </SelectTrigger>
                    <SelectContent>
                      {suggested.map((c) => (
                        <SelectItem key={"s" + c} value={c}>
                          {c} · existing slot
                        </SelectItem>
                      ))}
                      {freeLocs
                        .filter((l) => !suggested.includes(l.code) && (type !== "replenishment" || l.type === "pick-bin" || l.type === "cold"))
                        .slice(0, 60)
                        .map((l) => (
                          <SelectItem key={l.id} value={l.code}>
                            {l.code} · {l.occupied === 0 ? "empty" : `${Math.round((l.occupied / l.capacity) * 100)}% full`}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              <Field label="Quantity" htmlFor="tr-qty" required>
                <div className="flex gap-2">
                  <Input id="tr-qty" type="number" min={1} max={src?.available} value={qty} onChange={(e) => setQty(e.target.value)} />
                  <Button type="button" variant="secondary" disabled={!src} onClick={() => setQty(String(src?.available ?? ""))}>
                    All
                  </Button>
                </div>
              </Field>
              <Field label="Reason" htmlFor="tr-reason">
                <Textarea id="tr-reason" rows={1} className="min-h-8" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Optional" />
              </Field>
            </div>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Requesting…" : "Request transfer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
