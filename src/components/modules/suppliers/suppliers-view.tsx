"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Mail, PackageOpen, PauseCircle, Phone, PlayCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { INBOUND_STATUS } from "@/lib/status";
import { formatCurrency, formatDate } from "@/lib/format";
import { CATEGORIES, type Category, type Supplier } from "@/types";
import type { BadgeTone } from "@/components/ui/badge";

const SUPPLIER_STATUS: Record<Supplier["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  on_hold: { label: "On hold", tone: "warning" },
  inactive: { label: "Inactive", tone: "neutral" },
};

type Row = Supplier & { openAsns: number; skus: number };

export function SuppliersView() {
  const { suppliers, products, all, actions, can } = useWms();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);

  const rows = React.useMemo<Row[]>(
    () =>
      suppliers.map((s) => ({
        ...s,
        openAsns: all.inbound.filter((i) => i.supplierId === s.id && i.status !== "completed").length,
        skus: products.filter((p) => p.supplierId === s.id).length,
      })),
    [suppliers, products, all.inbound]
  );
  const sel = rows.find((r) => r.id === openId);
  const active = suppliers.filter((s) => s.status === "active");

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "name",
      header: "Supplier",
      meta: { label: "Supplier" },
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="font-mono text-2xs text-muted-foreground">{row.original.code}</div>
        </div>
      ),
    },
    { accessorKey: "contactName", header: "Contact", meta: { label: "Contact" }, cell: ({ row }) => <div><div>{row.original.contactName}</div><div className="text-2xs text-muted-foreground">{row.original.email}</div></div> },
    { accessorKey: "country", header: "Location", meta: { label: "Location" }, filterFn: inArrayFilter, cell: ({ row }) => <span className="text-muted-foreground">{row.original.city}, {row.original.country}</span> },
    { id: "categories", header: "Categories", meta: { label: "Categories" }, accessorFn: (r) => r.categories.join(", "), filterFn: (row, _id, v: string[]) => !v?.length || row.original.categories.some((c) => v.includes(c)), cell: ({ row }) => <div className="flex max-w-[200px] flex-wrap gap-1">{row.original.categories.map((c) => <Badge key={c}>{c}</Badge>)}</div> },
    { accessorKey: "skus", header: "SKUs", meta: { align: "right", label: "SKUs" } },
    { accessorKey: "leadTimeDays", header: "Lead time", meta: { align: "right", label: "Lead time" }, cell: ({ getValue }) => `${getValue()} d` },
    {
      accessorKey: "onTimeRate",
      header: "On-time",
      meta: { label: "On-time" },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <div className="flex w-28 items-center gap-2">
            <Progress value={v} size="xs" tone={v < 90 ? "danger" : v < 95 ? "warning" : "success"} className="flex-1" />
            <span className="w-10 text-right text-xs tabular">{v}%</span>
          </div>
        );
      },
    },
    { accessorKey: "qualityScore", header: "Quality", meta: { align: "right", label: "Quality" }, cell: ({ getValue }) => `${getValue()}%` },
    { accessorKey: "openAsns", header: "Open ASNs", meta: { align: "right", label: "Open ASNs" } },
    { accessorKey: "spendYtd", header: "Spend YTD", meta: { align: "right", label: "Spend YTD" }, cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={SUPPLIER_STATUS} value={row.original.status} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Vendor master data and inbound performance across the network"
        actions={
          can("partners.manage") && (
            <Button onClick={() => setAddOpen(true)}>
              <Plus /> Add supplier
            </Button>
          )
        }
      />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Active suppliers", `${active.length}`, `${suppliers.length - active.length} on hold / inactive`],
          ["Avg. on-time delivery", `${(active.reduce((s, x) => s + x.onTimeRate, 0) / (active.length || 1)).toFixed(1)}%`, "trailing 12 months"],
          ["Open ASNs", `${rows.reduce((s, r) => s + r.openAsns, 0)}`, "all sites"],
          ["Spend YTD", formatCurrency(suppliers.reduce((s, x) => s + x.spendYtd, 0)), "purchase orders received"],
        ].map(([k, v, h]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
            <div className="text-2xs text-muted-foreground">{h}</div>
          </div>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search supplier, contact, city…"
        searchText={(r) => `${r.name} ${r.code} ${r.contactName} ${r.email} ${r.city} ${r.country}`}
        facets={[
          { columnId: "categories", title: "Category", options: CATEGORIES.map((c) => ({ label: c, value: c })) },
          { columnId: "country", title: "Country", options: [...new Set(suppliers.map((s) => s.country))].sort().map((c) => ({ label: c, value: c })) },
          { columnId: "status", title: "Status", options: Object.entries(SUPPLIER_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        initialSorting={[{ id: "spendYtd", desc: true }]}
        initialVisibility={{ qualityScore: false }}
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        exportName="suppliers"
        exportRow={(r) => ({ code: r.code, name: r.name, contact: r.contactName, email: r.email, phone: r.phone, city: r.city, country: r.country, lead_time_days: r.leadTimeDays, on_time_pct: r.onTimeRate, quality_pct: r.qualityScore, spend_ytd: r.spendYtd, status: r.status })}
      />

      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent width="lg">
          {sel && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>{sel.name}</SheetTitle>
                  <StatusBadge map={SUPPLIER_STATUS} value={sel.status} />
                </div>
                <SheetDescription className="font-mono">{sel.code} · {sel.paymentTerms}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["On-time", `${sel.onTimeRate}%`],
                    ["Quality", `${sel.qualityScore}%`],
                    ["Lead time", `${sel.leadTimeDays} days`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md border bg-subtle px-3 py-2">
                      <div className="text-2xs text-muted-foreground">{k}</div>
                      <div className="text-base font-semibold tabular">{v}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <SectionTitle>Contact</SectionTitle>
                  <DescriptionList items={[["Name", sel.contactName], ["Email", <a key="e" href={`mailto:${sel.email}`} className="text-primary hover:underline">{sel.email}</a>], ["Phone", sel.phone], ["Location", `${sel.city}, ${sel.country}`], ["Spend YTD", formatCurrency(sel.spendYtd)], ["Categories", sel.categories.join(", ")]]} />
                </div>
                <div>
                  <SectionTitle>Recent shipments</SectionTitle>
                  <div className="divide-y rounded-md border">
                    {all.inbound.filter((i) => i.supplierId === sel.id).slice(-6).reverse().map((i) => (
                      <Link key={i.id} href={`/inbound?id=${i.id}`} className="flex items-center justify-between px-3 py-2 text-[13px] hover:bg-subtle">
                        <span className="font-mono text-xs">{i.id} <span className="text-muted-foreground">· {i.warehouseId}</span></span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">{formatDate(i.expectedAt)} <StatusBadge map={INBOUND_STATUS} value={i.status} /></span>
                      </Link>
                    ))}
                    {!all.inbound.some((i) => i.supplierId === sel.id) && <div className="px-3 py-4 text-center text-xs text-muted-foreground">No shipments on record</div>}
                  </div>
                </div>
                <div>
                  <SectionTitle>Products supplied ({sel.skus})</SectionTitle>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {products.filter((p) => p.supplierId === sel.id).slice(0, 10).map((p) => (
                      <Link key={p.id} href={`/inventory?q=${p.sku}`} className="flex items-center gap-2 rounded-md border px-2 py-1.5 hover:bg-subtle">
                        <ProductThumb category={p.category} size="sm" />
                        <span className="min-w-0"><span className="block truncate text-xs">{p.name}</span><span className="block font-mono text-2xs text-muted-foreground">{p.sku}</span></span>
                      </Link>
                    ))}
                  </div>
                </div>
              </SheetBody>
              <SheetFooter className="justify-between">
                <div className="flex gap-1">
                  <Button variant="ghost" asChild><a href={`mailto:${sel.email}`}><Mail /> Email</a></Button>
                  <Button variant="ghost" asChild><a href={`tel:${sel.phone.replace(/[^+\d]/g, "")}`}><Phone /> Call</a></Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={!can("partners.manage")}
                    title={can("partners.manage") ? undefined : "Requires warehouse manager or above"}
                    onClick={async () => {
                      const { openAsns: _a, skus: _s, ...supplier } = sel;
                      const status = sel.status === "active" ? "on_hold" : "active";
                      if (await actions.upsertSupplier({ ...supplier, status }, false)) toast.success(status === "on_hold" ? `${sel.name} placed on hold` : `${sel.name} reactivated`);
                    }}
                  >
                    {sel.status === "active" ? <><PauseCircle /> Put on hold</> : <><PlayCircle /> Activate</>}
                  </Button>
                  <Button asChild>
                    <Link href="/inbound?new=1"><PackageOpen /> New ASN</Link>
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AddSupplierDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddSupplierDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { suppliers, actions } = useWms();
  const empty = { name: "", contactName: "", email: "", phone: "", city: "", country: "United States", leadTimeDays: "5", category: "Packaging" as Category, paymentTerms: "Net 30" };
  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setF(empty);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.contactName.trim()) return setError("Company and contact name are required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setError("Enter a valid email address.");
    if (suppliers.some((s) => s.name.toLowerCase() === f.name.trim().toLowerCase())) return setError("A supplier with this name already exists.");
    const s: Supplier = {
      id: `sup_${Date.now().toString(36)}`,
      code: `SUP-${1200 + suppliers.length * 7}`,
      name: f.name.trim(),
      contactName: f.contactName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim() || "—",
      city: f.city.trim() || "—",
      country: f.country,
      leadTimeDays: Number(f.leadTimeDays) || 5,
      onTimeRate: 100,
      qualityScore: 100,
      openPOs: 0,
      spendYtd: 0,
      categories: [f.category],
      paymentTerms: f.paymentTerms,
      status: "active",
    };
    const res = await actions.upsertSupplier(s, true);
    if (!res) return;
    toast.success(`${s.name} added`);
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
            <DialogDescription>New vendors start with a 100% scorecard until their first receipt.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
            <Field label="Contact name" required><Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
            <Field label="Email" required><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="City"><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Country"><Input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
            <Field label="Lead time (days)"><Input type="number" min={0} value={f.leadTimeDays} onChange={(e) => set("leadTimeDays", e.target.value)} /></Field>
            <Field label="Primary category">
              <Select value={f.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Payment terms">
              <Select value={f.paymentTerms} onValueChange={(v) => set("paymentTerms", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Net 30", "Net 45", "Net 60", "2/10 Net 30"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text sm:col-span-2">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add supplier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

