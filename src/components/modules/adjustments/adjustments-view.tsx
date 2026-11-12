"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/form-field";
import { SkuPicker } from "@/components/shared/sku-picker";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ADJUSTMENT_STATUS } from "@/lib/status";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdjustmentReason, Product, StockAdjustment } from "@/types";

const REASONS: AdjustmentReason[] = ["Cycle count", "Damaged goods", "Expired", "Found stock", "Shrinkage", "Data correction", "Return to stock"];
type Row = StockAdjustment & { delta: number };

export function AdjustmentsView() {
  const { adjustments, warehouse, actions, can } = useWms();
  const [tab, setTab] = React.useState<"pending" | "all">("all");
  const [open, setOpen] = React.useState(false);
  const [presetSku, setPresetSku] = React.useState<string | undefined>();
  const { confirm, dialog } = useConfirm();
  useQueryFlag("sku", setPresetSku);
  useQueryFlag("new", () => setOpen(true));

  const rows = React.useMemo<Row[]>(() => adjustments.map((a) => ({ ...a, delta: a.after - a.before })), [adjustments]);
  const pending = rows.filter((r) => r.status === "pending");
  const posted = rows.filter((r) => r.status === "approved");
  const data = tab === "pending" ? pending : rows;

  const canApprove = can("adjustments.approve");
  const review = async (ids: string[], d: "approved" | "rejected") => {
    const r = await actions.reviewAdjustment(ids, d);
    if (r) toast.success(`${r.count} adjustment${r.count === 1 ? "" : "s"} ${d === "approved" ? "approved & posted" : "rejected"}`);
  };

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "id", header: "Adjustment", meta: { label: "Adjustment" }, cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span> },
    {
      accessorKey: "sku",
      header: "Product",
      meta: { label: "Product" },
      cell: ({ row }) => (
        <div className="max-w-[230px]">
          <div className="truncate">{row.original.productName}</div>
          <div className="font-mono text-2xs text-muted-foreground">{row.original.sku}</div>
        </div>
      ),
    },
    { accessorKey: "locationCode", header: "Location", meta: { label: "Location" }, cell: ({ getValue }) => <span className="font-mono text-2xs">{getValue() as string}</span> },
    { id: "beforeAfter", header: "Before → After", meta: { label: "Before → After", align: "right" }, accessorFn: (r) => r.after, cell: ({ row }) => <span className="tabular text-muted-foreground">{formatNumber(row.original.before)} → <span className="text-foreground">{formatNumber(row.original.after)}</span></span> },
    { accessorKey: "delta", header: "Change", meta: { align: "right", label: "Change" }, cell: ({ getValue }) => { const d = getValue() as number; return <span className={cn("font-medium tabular", d < 0 ? "text-danger-text" : "text-success-text")}>{d > 0 ? "+" : ""}{d}</span>; } },
    { accessorKey: "reason", header: "Reason", meta: { label: "Reason" }, filterFn: inArrayFilter, cell: ({ row }) => <div><Badge>{row.original.reason}</Badge>{row.original.note && <div className="mt-0.5 max-w-[200px] truncate text-2xs text-muted-foreground">{row.original.note}</div>}</div> },
    { accessorKey: "valueImpact", header: "Value", meta: { align: "right", label: "Value impact" }, cell: ({ getValue }) => { const v = getValue() as number; return <span className={cn("tabular", v < 0 ? "text-danger-text" : "text-success-text")}>{v > 0 ? "+" : ""}{formatCurrency(v, true)}</span>; } },
    { accessorKey: "requestedBy", header: "Requested by", meta: { label: "Requested by" } },
    { accessorKey: "createdAt", header: "Date", meta: { label: "Date" }, cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue() as string)}</span> },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <div><StatusBadge map={ADJUSTMENT_STATUS} value={row.original.status} />{row.original.approvedBy && <div className="mt-0.5 text-2xs text-muted-foreground">by {row.original.approvedBy}</div>}</div> },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "pending" && canApprove ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="secondary" onClick={() => review([row.original.id], "approved")}>
              <Check /> Approve
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Reject" onClick={() => review([row.original.id], "rejected")}>
              <X />
            </Button>
          </div>
        ) : null,
    },
  ];

  const netUnits = posted.reduce((s, r) => s + r.delta, 0);
  const netValue = posted.reduce((s, r) => s + r.valueImpact, 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Adjustments"
        description={`Cycle counts, write-offs and corrections · ${warehouse.name}`}
        actions={
          <Button
            onClick={() => {
              setPresetSku(undefined);
              setOpen(true);
            }}
          >
            <Plus /> New adjustment
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Pending approval", String(pending.length), pending.length ? `${formatCurrency(pending.reduce((s, r) => s + r.valueImpact, 0), true)} at stake` : "Queue clear"],
          ["Posted adjustments", String(posted.length), "last 21 days"],
          ["Net units", `${netUnits > 0 ? "+" : ""}${formatNumber(netUnits)}`, "posted"],
          ["Net value impact", formatCurrency(netValue, true), `inventory accuracy ${(100 - (Math.abs(netUnits) / 89000) * 100).toFixed(2)}%`],
        ].map(([k, v, h]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
            <div className="text-2xs text-muted-foreground">{h}</div>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="all">All adjustments</TabsTrigger>
          <TabsTrigger value="pending">
            Pending approval {pending.length > 0 && <span className="rounded bg-warning-soft px-1.5 text-2xs text-warning-text">{pending.length}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        key={warehouse.id + tab}
        columns={columns}
        data={data}
        searchPlaceholder="Search adjustment, SKU, location, user…"
        searchText={(r) => `${r.id} ${r.sku} ${r.productName} ${r.locationCode} ${r.requestedBy} ${r.reason}`}
        facets={[
          { columnId: "reason", title: "Reason", options: REASONS.map((r) => ({ label: r, value: r })) },
          { columnId: "status", title: "Status", options: Object.entries(ADJUSTMENT_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        initialVisibility={{ requestedBy: false }}
        getRowId={(r) => r.id}
        selectable={canApprove}
        bulkActions={(sel, clear) => {
          const ids = sel.filter((s) => s.status === "pending").map((s) => s.id);
          return (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={!ids.length}
                onClick={() => {
                  const list = sel.filter((s) => s.status === "pending");
                  const value = list.reduce((a, r) => a + r.valueImpact, 0);
                  confirm({
                    title: `Post ${ids.length} adjustment${ids.length === 1 ? "" : "s"} to inventory?`,
                    description: `Stock on hand changes immediately. Net value impact ${formatCurrency(value, true)}.`,
                    items: list.map((r) => `${r.id} · ${r.sku} ${r.delta > 0 ? "+" : ""}${r.delta} at ${r.locationCode}`),
                    confirmLabel: `Approve & post ${ids.length}`,
                    onConfirm: () => {
                      review(ids, "approved");
                      clear();
                    },
                  });
                }}
              >
                <Check /> Approve {ids.length}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!ids.length}
                onClick={() =>
                  confirm({
                    title: `Reject ${ids.length} adjustment${ids.length === 1 ? "" : "s"}?`,
                    description: "Stock stays unchanged. The requesters see the rejection in the activity log.",
                    confirmLabel: `Reject ${ids.length}`,
                    tone: "danger",
                    onConfirm: () => {
                      review(ids, "rejected");
                      clear();
                    },
                  })
                }
              >
                <X /> Reject
              </Button>
            </>
          );
        }}
        exportName={`adjustments-${warehouse.id}`}
        exportRow={(r) => ({ id: r.id, sku: r.sku, location: r.locationCode, before: r.before, after: r.after, change: r.delta, reason: r.reason, value: r.valueImpact, requested_by: r.requestedBy, status: r.status, date: r.createdAt })}
      />
      <NewAdjustmentDialog open={open} onOpenChange={setOpen} presetSku={presetSku} />
      {dialog}
    </div>
  );
}

function NewAdjustmentDialog({ open, onOpenChange, presetSku }: { open: boolean; onOpenChange: (v: boolean) => void; presetSku?: string }) {
  const { products, inventory, actions, can, roleLabel } = useWms();
  const canPost = can("adjustments.approve");
  const [saving, setSaving] = React.useState(false);
  const [product, setProduct] = React.useState<Product | undefined>();
  const [loc, setLoc] = React.useState("");
  const [counted, setCounted] = React.useState("");
  const [reason, setReason] = React.useState<AdjustmentReason>("Cycle count");
  const [note, setNote] = React.useState("");
  const [postNow, setPostNow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stocked = React.useMemo(() => {
    const ids = new Set(inventory.map((r) => r.productId));
    return products.filter((p) => ids.has(p.id));
  }, [inventory, products]);

  React.useEffect(() => {
    if (!open) return;
    setProduct(presetSku ? stocked.find((p) => p.sku === presetSku) : undefined);
    setLoc("");
    setCounted("");
    setReason("Cycle count");
    setNote("");
    setPostNow(false);
    setError(null);
  }, [open, presetSku, stocked]);

  const recs = product ? inventory.filter((r) => r.productId === product.id) : [];
  const rec = recs.find((r) => r.locationCode === loc);
  React.useEffect(() => {
    if (recs.length === 1 && !loc) setLoc(recs[0].locationCode);
  }, [recs, loc]);
  const delta = rec && counted !== "" ? Number(counted) - rec.total : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !rec) return setError("Select a product and location.");
    if (counted === "" || Number(counted) < 0) return setError("Enter the counted quantity.");
    if (delta === 0) return setError("Counted quantity matches system — no adjustment needed.");
    if (reason !== "Cycle count" && reason !== "Data correction" && !note.trim()) return setError("Add a note explaining the adjustment.");
    setSaving(true);
    const res = await actions.createAdjustment({ productId: product.id, locationCode: rec.locationCode, counted: Number(counted), reason, note: note.trim() || undefined, postNow: postNow && canPost });
    setSaving(false);
    if (!res) return;
    toast.success(`${res.id} ${res.status === "approved" ? "posted" : "submitted for approval"}`, { description: `${product.sku} ${delta > 0 ? "+" : ""}${delta} at ${rec.locationCode}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New stock adjustment</DialogTitle>
            <DialogDescription>Record a count difference or write-off. Adjustments over $250 require supervisor approval.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Product" required>
              <SkuPicker products={stocked} value={product?.id} onChange={(p) => { setProduct(p); setLoc(""); }} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Location" required>
                <Select value={loc} onValueChange={setLoc} disabled={!product}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {recs.map((r) => (
                      <SelectItem key={r.id} value={r.locationCode}>
                        {r.locationCode} · {r.total} on hand
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Counted quantity" htmlFor="adj-count" required hint={rec ? `System: ${rec.total}` : undefined}>
                <Input id="adj-count" type="number" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} disabled={!rec} />
              </Field>
            </div>
            {rec && counted !== "" && (
              <div className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-[13px]", delta < 0 ? "border-danger/30 bg-danger-soft" : delta > 0 ? "border-success/30 bg-success-soft" : "bg-subtle")}>
                <span>Variance</span>
                <span className="font-semibold tabular">
                  {delta > 0 ? "+" : ""}
                  {delta} units · {formatCurrency(delta * (product?.unitCost ?? 0), true)}
                </span>
              </div>
            )}
            <Field label="Reason" required>
              <Select value={reason} onValueChange={(v) => setReason(v as AdjustmentReason)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Note" htmlFor="adj-note">
              <Textarea id="adj-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for damage, expiry, shrinkage…" />
            </Field>
            {canPost && (
              <div className="flex items-center justify-between rounded-md border bg-subtle px-3 py-2.5">
                <div>
                  <Label htmlFor="adj-post">Post immediately</Label>
                  <p className="text-2xs text-muted-foreground">Skip approval — your role ({roleLabel}) can approve adjustments.</p>
                </div>
                <Switch id="adj-post" checked={postNow} onCheckedChange={setPostNow} />
              </div>
            )}
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : postNow && canPost ? "Post adjustment" : "Submit for approval"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
