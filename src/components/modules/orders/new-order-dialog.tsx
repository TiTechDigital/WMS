"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { SkuPicker } from "@/components/shared/sku-picker";
import { useWms, nowIso } from "@/store/wms-store";
import { formatCurrency } from "@/lib/format";
import { REFERENCE_NOW } from "@/lib/constants";
import type { Order, Priority, Product } from "@/types";

type Line = { product?: Product; qty: string };
const SERVICES: [string, string][] = [
  ["UPS", "Ground"],
  ["UPS", "Next Day Air"],
  ["FedEx", "Ground"],
  ["FedEx", "Priority Overnight"],
  ["USPS", "Priority Mail"],
  ["XPO Logistics", "LTL Standard"],
];

export function NewOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { customers, products, inventory, warehouse, orders, actions } = useWms();
  const [customerId, setCustomerId] = React.useState("");
  const [priority, setPriority] = React.useState<Priority>("normal");
  const [service, setService] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([{ qty: "1" }]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setCustomerId("");
      setPriority("normal");
      setService("0");
      setNotes("");
      setLines([{ qty: "1" }]);
      setError(null);
    }
  }, [open]);

  const stocked = React.useMemo(() => {
    const avail = new Map<string, number>();
    inventory.forEach((r) => avail.set(r.productId, (avail.get(r.productId) ?? 0) + r.available));
    return { list: products.filter((p) => (avail.get(p.id) ?? 0) > 0), avail };
  }, [inventory, products]);

  const total = lines.reduce((s, l) => s + (l.product ? l.product.unitPrice * (Number(l.qty) || 0) : 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (!customerId) return setError("Select a customer.");
    if (!valid.length) return setError("Add at least one product.");
    const short = valid.find((l) => Number(l.qty) > (stocked.avail.get(l.product!.id) ?? 0));
    if (short) return setError(`Only ${stocked.avail.get(short.product!.id)} units of ${short.product!.sku} available.`);
    const c = customers.find((x) => x.id === customerId)!;
    const [carrier, svc] = SERVICES[Number(service)];
    const maxId = Math.max(...orders.map((o) => Number(o.id.replace("SO-", "")) || 0));
    const hours = priority === "urgent" ? 8 : priority === "high" ? 20 : 44;
    const o: Order = {
      id: `SO-${maxId + 3}`,
      warehouseId: warehouse.id,
      customerId: c.id,
      customerName: c.name,
      channel: "Manual",
      createdAt: nowIso(),
      requestedShipAt: new Date(REFERENCE_NOW.getTime() + hours * 3600000).toISOString(),
      priority,
      status: "new",
      shippingAddress: c.address,
      carrier,
      service: svc,
      lines: valid.map((l) => {
        const loc = inventory.find((r) => r.productId === l.product!.id && r.available > 0)?.locationCode ?? "";
        return { productId: l.product!.id, sku: l.product!.sku, productName: l.product!.name, locationCode: loc, quantity: Number(l.qty), picked: 0, packed: 0, unitPrice: l.product!.unitPrice };
      }),
      weightKg: Number(valid.reduce((s, l) => s + l.product!.weightKg * Number(l.qty), 0).toFixed(1)),
      cartons: Math.max(1, Math.ceil(valid.reduce((s, l) => s + l.product!.weightKg * Number(l.qty), 0) / 18)),
      notes: notes.trim() || undefined,
    };
    actions.createOrder(o);
    toast.success(`${o.id} created`, { description: `${c.name} · ${valid.length} lines · ${formatCurrency(total)}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New sales order</DialogTitle>
            <DialogDescription>Manual order entry for {warehouse.name}. Only SKUs with available stock are listed.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Customer" required className="sm:col-span-3">
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers
                      .filter((c) => c.status === "active")
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {c.address.city}, {c.address.state}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["low", "normal", "high", "urgent"] as Priority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {p[0].toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Shipping service" className="sm:col-span-2">
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICES.map(([c, s], i) => (
                      <SelectItem key={i} value={String(i)}>
                        {c} {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Products</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((l) => [...l, { qty: "1" }])}>
                  <Plus /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <SkuPicker products={stocked.list} value={l.product?.id} onChange={(p) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, product: p } : x)))} className="flex-1" />
                    <Input type="number" min={1} value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="w-20 text-right" aria-label="Quantity" />
                    <span className="w-20 text-right text-2xs text-muted-foreground tabular">{l.product ? `${stocked.avail.get(l.product.id)} avail.` : ""}</span>
                    <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-end text-[13px]">
                <span className="text-muted-foreground">Order total</span>
                <span className="ml-3 w-28 text-right font-semibold tabular">{formatCurrency(total, true)}</span>
              </div>
            </div>
            <Field label="Notes" htmlFor="o-notes">
              <Textarea id="o-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery instructions, references…" />
            </Field>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create order</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
