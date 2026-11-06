"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Mail, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { Field } from "@/components/shared/form-field";
import { ORDER_STATUS } from "@/lib/status";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Customer, CustomerType, SlaTier } from "@/types";

const CUSTOMER_STATUS: Record<Customer["status"], { label: string; tone: BadgeTone }> = {
  active: { label: "Active", tone: "success" },
  credit_hold: { label: "Credit hold", tone: "danger" },
  inactive: { label: "Inactive", tone: "neutral" },
};
const TIER_TONE: Record<SlaTier, BadgeTone> = { Platinum: "dark", Gold: "warning", Standard: "neutral" };
const TYPES: CustomerType[] = ["Retail", "Wholesale", "E-commerce", "Distributor"];

type Row = Customer & { openOrders: number; location: string };

export function CustomersView() {
  const { customers, all, actions } = useWms();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const rows = React.useMemo<Row[]>(
    () => customers.map((c) => ({ ...c, location: `${c.address.city}, ${c.address.state}`, openOrders: all.orders.filter((o) => o.customerId === c.id && !["shipped", "delivered", "cancelled"].includes(o.status)).length })),
    [customers, all.orders]
  );
  const sel = rows.find((r) => r.id === openId);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "name", header: "Customer", meta: { label: "Customer" }, cell: ({ row }) => <div><div className="font-medium">{row.original.name}</div><div className="font-mono text-2xs text-muted-foreground">{row.original.code}</div></div> },
    { accessorKey: "type", header: "Type", meta: { label: "Type" }, filterFn: inArrayFilter, cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: "slaTier", header: "SLA tier", meta: { label: "SLA tier" }, filterFn: inArrayFilter, cell: ({ row }) => <Badge tone={TIER_TONE[row.original.slaTier]}>{row.original.slaTier}</Badge> },
    { accessorKey: "contactName", header: "Contact", meta: { label: "Contact" }, cell: ({ row }) => <div><div>{row.original.contactName}</div><div className="text-2xs text-muted-foreground">{row.original.email}</div></div> },
    { accessorKey: "location", header: "Ship-to", meta: { label: "Ship-to" }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "openOrders", header: "Open orders", meta: { align: "right", label: "Open orders" } },
    { accessorKey: "ordersYtd", header: "Orders YTD", meta: { align: "right", label: "Orders YTD" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
    { accessorKey: "revenueYtd", header: "Revenue YTD", meta: { align: "right", label: "Revenue YTD" }, cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: "onTimeDelivery", header: "On-time", meta: { align: "right", label: "On-time" }, cell: ({ getValue }) => `${getValue()}%` },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={CUSTOMER_STATUS} value={row.original.status} /> },
  ];

  const recent = sel ? all.orders.filter((o) => o.customerId === sel.id).slice(0, 8) : [];

  return (
    <div className="space-y-4">
      <PageHeader title="Customers" description="Accounts, SLA tiers and ship-to data" actions={<Button onClick={() => setAddOpen(true)}><Plus /> Add customer</Button>} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Active accounts", `${customers.filter((c) => c.status === "active").length}`],
          ["Platinum / Gold", `${customers.filter((c) => c.slaTier !== "Standard").length}`],
          ["Open orders", `${rows.reduce((s, r) => s + r.openOrders, 0)}`],
          ["Revenue YTD", formatCurrency(customers.reduce((s, c) => s + c.revenueYtd, 0))],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search customer, contact, city…"
        searchText={(r) => `${r.name} ${r.code} ${r.contactName} ${r.email} ${r.location}`}
        facets={[
          { columnId: "type", title: "Type", options: TYPES.map((t) => ({ label: t, value: t })) },
          { columnId: "slaTier", title: "SLA tier", options: ["Platinum", "Gold", "Standard"].map((t) => ({ label: t, value: t })) },
          { columnId: "status", title: "Status", options: Object.entries(CUSTOMER_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        initialSorting={[{ id: "revenueYtd", desc: true }]}
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        exportName="customers"
        exportRow={(r) => ({ code: r.code, name: r.name, type: r.type, tier: r.slaTier, contact: r.contactName, email: r.email, city: r.address.city, state: r.address.state, orders_ytd: r.ordersYtd, revenue_ytd: r.revenueYtd, status: r.status })}
      />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent width="lg">
          {sel && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>{sel.name}</SheetTitle>
                  <Badge tone={TIER_TONE[sel.slaTier]}>{sel.slaTier}</Badge>
                  <StatusBadge map={CUSTOMER_STATUS} value={sel.status} />
                </div>
                <SheetDescription className="font-mono">{sel.code} · {sel.type}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-3 gap-2">
                  {[["Orders YTD", formatNumber(sel.ordersYtd)], ["Revenue YTD", formatCurrency(sel.revenueYtd)], ["On-time", `${sel.onTimeDelivery}%`]].map(([k, v]) => (
                    <div key={k} className="rounded-md border bg-subtle px-3 py-2"><div className="text-2xs text-muted-foreground">{k}</div><div className="text-base font-semibold tabular">{v}</div></div>
                  ))}
                </div>
                <div>
                  <SectionTitle>Account</SectionTitle>
                  <DescriptionList items={[["Contact", sel.contactName], ["Email", <a key="e" href={`mailto:${sel.email}`} className="text-primary hover:underline">{sel.email}</a>], ["Phone", sel.phone], ["Ship-to", `${sel.address.line1}, ${sel.address.city}, ${sel.address.state} ${sel.address.postalCode}`]]} />
                </div>
                <div>
                  <SectionTitle>Recent orders</SectionTitle>
                  <div className="divide-y rounded-md border">
                    {recent.map((o) => (
                      <Link key={o.id} href={`/orders?id=${o.id}`} className="flex items-center justify-between px-3 py-2 hover:bg-subtle">
                        <span className="font-mono text-xs">{o.id} <span className="text-muted-foreground">· {o.warehouseId}</span></span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">{formatDateTime(o.createdAt)} <StatusBadge map={ORDER_STATUS} value={o.status} /></span>
                      </Link>
                    ))}
                    {recent.length === 0 && <div className="px-3 py-4 text-center text-xs text-muted-foreground">No orders yet</div>}
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
                    onClick={() => {
                      const status = sel.status === "credit_hold" ? "active" : "credit_hold";
                      actions.upsertCustomer({ ...sel, status });
                      toast.success(status === "credit_hold" ? `${sel.name} placed on credit hold` : `Credit hold released`);
                    }}
                  >
                    {sel.status === "credit_hold" ? "Release credit hold" : "Credit hold"}
                  </Button>
                  <Button asChild><Link href="/orders?new=1"><ClipboardList /> New order</Link></Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddCustomerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { customers, actions } = useWms();
  const empty = { name: "", type: "Retail" as CustomerType, slaTier: "Standard" as SlaTier, contactName: "", email: "", phone: "", line1: "", city: "", state: "", postalCode: "" };
  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setF(empty);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() || !f.contactName.trim()) return setError("Company and contact name are required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setError("Enter a valid email address.");
    if (!f.line1.trim() || !f.city.trim() || !f.state.trim()) return setError("A complete ship-to address is required.");
    const c: Customer = {
      id: `cus_${Date.now().toString(36)}`,
      code: `CUS-${2800 + customers.length * 13}`,
      name: f.name.trim(),
      type: f.type,
      contactName: f.contactName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim() || "—",
      address: { line1: f.line1.trim(), city: f.city.trim(), state: f.state.trim().toUpperCase(), postalCode: f.postalCode.trim(), country: "US" },
      slaTier: f.slaTier,
      ordersYtd: 0,
      revenueYtd: 0,
      onTimeDelivery: 100,
      status: "active",
    };
    actions.upsertCustomer(c);
    toast.success(`${c.name} added`, { description: c.code });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add customer</DialogTitle>
            <DialogDescription>Create a ship-to account for order entry.</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" required className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
            <Field label="Type">
              <Select value={f.type} onValueChange={(v) => set("type", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="SLA tier">
              <Select value={f.slaTier} onValueChange={(v) => set("slaTier", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Platinum", "Gold", "Standard"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Contact name" required><Input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} /></Field>
            <Field label="Email" required><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Street address" required className="sm:col-span-2"><Input value={f.line1} onChange={(e) => set("line1", e.target.value)} /></Field>
            <Field label="City" required><Input value={f.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="State" required><Input maxLength={2} value={f.state} onChange={(e) => set("state", e.target.value)} /></Field>
              <Field label="ZIP"><Input value={f.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></Field>
            </div>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger sm:col-span-2">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add customer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
