"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { SkuPicker } from "@/components/shared/sku-picker";
import { useWms } from "@/store/wms-store";
import type { InboundShipment, Priority, Product } from "@/types";
import { currentTime } from "@/lib/constants";

type Line = { product?: Product; qty: string };
const CARRIERS = ["XPO Logistics", "Old Dominion", "Estes Express", "Saia LTL", "J.B. Hunt", "Maersk Line", "Supplier truck"];

export function NewAsnDialog({ open, onOpenChange, presetSku }: { open: boolean; onOpenChange: (v: boolean) => void; presetSku?: string }) {
  const { suppliers, products, warehouse, actions } = useWms();
  const [saving, setSaving] = React.useState(false);
  const tomorrow = new Date(currentTime().getTime() + 86400000).toISOString().slice(0, 10);
  const [supplierId, setSupplierId] = React.useState("");
  const [po, setPo] = React.useState("");
  const [carrier, setCarrier] = React.useState(CARRIERS[0]);
  const [date, setDate] = React.useState(tomorrow);
  const [time, setTime] = React.useState("09:00");
  const [priority, setPriority] = React.useState<Priority>("normal");
  const [lines, setLines] = React.useState<Line[]>([{ qty: "" }]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const preset = presetSku ? products.find((p) => p.sku === presetSku) : undefined;
    setSupplierId(preset?.supplierId ?? "");
    setPo(`PO-${44500 + Math.floor(Math.random() * 400)}`);
    setCarrier(CARRIERS[0]);
    setDate(tomorrow);
    setTime("09:00");
    setPriority(preset ? "high" : "normal");
    setLines([{ product: preset, qty: preset ? String(preset.reorderQty) : "" }]);
    setError(null);
  }, [open, presetSku, products, tomorrow]);

  const supplierProducts = supplierId ? products.filter((p) => p.supplierId === supplierId) : products;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = lines.filter((l) => l.product && Number(l.qty) > 0);
    if (!supplierId) return setError("Select a supplier.");
    if (!po.trim()) return setError("Enter a PO number.");
    if (!valid.length) return setError("Add at least one line with a quantity.");
    const supplier = suppliers.find((s) => s.id === supplierId)!;
    setSaving(true);
    const res = await actions.createInbound({
      supplierId,
      poNumber: po.trim(),
      carrier,
      expectedAt: new Date(`${date}T${time}:00Z`).toISOString(),
      priority,
      lines: valid.map((l) => ({ productId: l.product!.id, expected: Number(l.qty) })),
    });
    setSaving(false);
    if (!res) return;
    toast.success(`${res.id} created`, { description: `${supplier.name} · ${valid.length} lines · ETA ${date} ${time} UTC` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>New advance shipping notice</DialogTitle>
            <DialogDescription>Pre-register an inbound delivery for {warehouse.name}.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier" required>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers
                      .filter((s) => s.status === "active")
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Purchase order" htmlFor="asn-po" required>
                <Input id="asn-po" value={po} onChange={(e) => setPo(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Carrier">
                <Select value={carrier} onValueChange={setCarrier}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
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
                      <SelectItem key={p} value={p} className="capitalize">
                        {p[0].toUpperCase() + p.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Expected arrival (UTC)" htmlFor="asn-date" required className="sm:col-span-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input id="asn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Arrival date" />
                  <Input id="asn-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Arrival time" />
                </div>
              </Field>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium">Lines</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setLines((l) => [...l, { qty: "" }])}>
                  <Plus /> Add line
                </Button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <SkuPicker products={supplierProducts} value={l.product?.id} onChange={(p) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, product: p, qty: x.qty || String(p.reorderQty) } : x)))} className="flex-1" />
                    <Input type="number" min={1} placeholder="Qty" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} className="w-24 text-right" aria-label="Quantity" />
                    <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="Remove line">
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create ASN"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
