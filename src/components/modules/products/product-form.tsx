"use client";

import * as React from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/shared/form-field";
import { ProductThumb } from "@/components/shared/product-thumb";
import { useWms, nowIso } from "@/store/wms-store";
import { CATEGORIES, type Category, type Product, type ProductStatus, type StorageCondition, type UnitOfMeasure } from "@/types";

const UOMS: UnitOfMeasure[] = ["EA", "BOX", "CS", "PK", "RL", "KG", "L", "PLT"];
const PREFIX: Record<Category, string> = {
  Electronics: "ELC",
  "Power Tools": "PWT",
  "Industrial Supplies": "IND",
  Packaging: "PKG",
  "Home & Kitchen": "HMK",
  "Health & Beauty": "HLB",
  "Food & Beverage": "FNB",
  Automotive: "AUT",
  "Office Supplies": "OFC",
};

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  category: Category;
  brand: string;
  description: string;
  uom: UnitOfMeasure;
  unitsPerCase: string;
  weightKg: string;
  length: string;
  width: string;
  height: string;
  minStock: string;
  maxStock: string;
  reorderQty: string;
  supplierId: string;
  unitCost: string;
  unitPrice: string;
  storage: StorageCondition;
  status: ProductStatus;
  imageUrl?: string;
};

function ean13() {
  const base = "0" + String(Math.floor(Math.random() * 1e11)).padStart(11, "0");
  const sum = base.split("").reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
  return base + ((10 - (sum % 10)) % 10);
}

function fromProduct(p?: Product): FormState {
  return {
    name: p?.name ?? "",
    sku: p?.sku ?? "",
    barcode: p?.barcode ?? "",
    category: p?.category ?? "Electronics",
    brand: p?.brand ?? "",
    description: p?.description ?? "",
    uom: p?.uom ?? "EA",
    unitsPerCase: String(p?.unitsPerCase ?? 1),
    weightKg: p ? String(p.weightKg) : "",
    length: p ? String(p.dimensions.length) : "",
    width: p ? String(p.dimensions.width) : "",
    height: p ? String(p.dimensions.height) : "",
    minStock: p ? String(p.minStock) : "",
    maxStock: p ? String(p.maxStock) : "",
    reorderQty: p ? String(p.reorderQty) : "",
    supplierId: p?.supplierId ?? "",
    unitCost: p ? String(p.unitCost) : "",
    unitPrice: p ? String(p.unitPrice) : "",
    storage: p?.storage ?? "ambient",
    status: p?.status ?? "draft",
    imageUrl: p?.imageUrl,
  };
}

export function ProductFormDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product?: Product }) {
  const { suppliers, products, actions } = useWms();
  const [f, setF] = React.useState<FormState>(fromProduct(product));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [tab, setTab] = React.useState("general");
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isEdit = !!product;

  React.useEffect(() => {
    if (open) {
      setF(fromProduct(product));
      setErrors({});
      setTab("general");
    }
  }, [open, product]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    const linked = k === "width" || k === "height" ? "length" : k;
    setErrors((e) => (e[linked as keyof FormState] ? { ...e, [linked]: undefined } : e));
  };
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!f.name.trim()) e.name = "Product name is required";
    if (!f.sku.trim()) e.sku = "SKU is required";
    else if (!/^[A-Z0-9-]+$/.test(f.sku)) e.sku = "Use uppercase letters, digits and dashes";
    else if (products.some((p) => p.sku === f.sku && p.id !== product?.id)) e.sku = "SKU already exists";
    if (!/^\d{8,14}$/.test(f.barcode)) e.barcode = "Barcode must be 8–14 digits (EAN/UPC/GTIN)";
    if (!f.supplierId) e.supplierId = "Select a supplier";
    if (!(num(f.weightKg) > 0)) e.weightKg = "Enter a weight";
    if (!(num(f.length) > 0 && num(f.width) > 0 && num(f.height) > 0)) e.length = "Enter all dimensions";
    if (!(num(f.minStock) >= 0)) e.minStock = "Required";
    if (!(num(f.maxStock) > 0)) e.maxStock = "Required";
    else if (num(f.maxStock) <= num(f.minStock)) e.maxStock = "Max must exceed min";
    if (!(num(f.unitCost) >= 0)) e.unitCost = "Required";
    setErrors(e);
    if (Object.keys(e).length) {
      const generalKeys = ["name", "sku", "barcode", "supplierId"];
      setTab(Object.keys(e).some((k) => generalKeys.includes(k)) ? "general" : Object.keys(e).some((k) => ["weightKg", "length"].includes(k)) ? "logistics" : "stock");
    }
    return Object.keys(e).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const p: Product = {
      id: product?.id ?? `prd_${Date.now().toString(36)}`,
      sku: f.sku,
      name: f.name.trim(),
      barcode: f.barcode,
      category: f.category,
      brand: f.brand.trim() || "Generic",
      description: f.description.trim(),
      uom: f.uom,
      unitsPerCase: Math.max(1, Number(f.unitsPerCase) || 1),
      weightKg: num(f.weightKg),
      dimensions: { length: num(f.length), width: num(f.width), height: num(f.height) },
      minStock: num(f.minStock),
      maxStock: num(f.maxStock),
      reorderQty: num(f.reorderQty) || Math.round((num(f.maxStock) - num(f.minStock)) / 10) * 10,
      supplierId: f.supplierId,
      unitCost: num(f.unitCost),
      unitPrice: num(f.unitPrice) || Number((num(f.unitCost) * 1.5).toFixed(2)),
      storage: f.storage,
      status: f.status,
      imageUrl: f.imageUrl,
      createdAt: product?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };
    actions.upsertProduct(p);
    toast.success(isEdit ? "Product updated" : "Product created", { description: `${p.sku} · ${p.name}` });
    onOpenChange(false);
  };

  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2 MB");
    const reader = new FileReader();
    reader.onload = () => set("imageUrl", String(reader.result));
    reader.readAsDataURL(file);
  };

  const cube = num(f.length) * num(f.width) * num(f.height);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${product.sku}` : "Add product"}</DialogTitle>
            <DialogDescription>{isEdit ? "Changes apply to all sites immediately." : "Create a new SKU in the master catalog."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-6 md:grid-cols-[180px_1fr]">
            {/* Image */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFile(e.dataTransfer.files?.[0]);
                }}
                className="group relative block aspect-square w-full overflow-hidden rounded-lg border border-dashed bg-subtle transition-colors hover:border-primary"
              >
                {f.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
                    <ProductThumb category={f.category} size="lg" />
                    <span className="text-2xs text-muted-foreground">
                      <ImagePlus className="mr-1 inline size-3" />
                      Drop image or click to upload
                    </span>
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              {f.imageUrl && (
                <Button type="button" variant="danger-ghost" size="sm" className="w-full" onClick={() => set("imageUrl", undefined)}>
                  <Trash2 /> Remove image
                </Button>
              )}
              <p className="text-2xs text-muted-foreground">PNG or JPG, up to 2 MB. Square images work best.</p>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="logistics">Logistics</TabsTrigger>
                <TabsTrigger value="stock">Stock & pricing</TabsTrigger>
              </TabsList>

              <TabsContent value="general" forceMount className="grid gap-4 pt-4 data-[state=inactive]:hidden sm:grid-cols-2">
                <Field label="Product name" htmlFor="p-name" required error={errors.name} className="sm:col-span-2">
                  <Input id="p-name" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Cordless Drill Driver 18V" autoFocus />
                </Field>
                <Field label="SKU" htmlFor="p-sku" required error={errors.sku}>
                  <div className="flex gap-1.5">
                    <Input id="p-sku" value={f.sku} onChange={(e) => set("sku", e.target.value.toUpperCase())} className="font-mono" placeholder="PWT-10001" />
                    <Button type="button" variant="secondary" size="icon" title="Generate SKU" onClick={() => set("sku", `${PREFIX[f.category]}-${Math.floor(20000 + Math.random() * 9999)}`)}>
                      <RefreshCw />
                    </Button>
                  </div>
                </Field>
                <Field label="Barcode (EAN-13)" htmlFor="p-bc" required error={errors.barcode}>
                  <div className="flex gap-1.5">
                    <Input id="p-bc" value={f.barcode} inputMode="numeric" onChange={(e) => set("barcode", e.target.value.replace(/\D/g, ""))} className="font-mono" placeholder="Scan or type" />
                    <Button type="button" variant="secondary" size="icon" title="Generate barcode" onClick={() => set("barcode", ean13())}>
                      <RefreshCw />
                    </Button>
                  </div>
                </Field>
                <Field label="Category" required>
                  <Select value={f.category} onValueChange={(v) => set("category", v as Category)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Brand" htmlFor="p-brand">
                  <Input id="p-brand" value={f.brand} onChange={(e) => set("brand", e.target.value)} />
                </Field>
                <Field label="Supplier" required error={errors.supplierId}>
                  <Select value={f.supplierId} onValueChange={(v) => set("supplierId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers
                        .filter((s) => s.status !== "inactive")
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={f.status} onValueChange={(v) => set("status", v as ProductStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="discontinued">Discontinued</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Description" htmlFor="p-desc" className="sm:col-span-2">
                  <Textarea id="p-desc" value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} placeholder="Short description shown on pick lists and packing slips" />
                </Field>
              </TabsContent>

              <TabsContent value="logistics" forceMount className="grid gap-4 pt-4 data-[state=inactive]:hidden sm:grid-cols-3">
                <Field label="Unit of measure" required>
                  <Select value={f.uom} onValueChange={(v) => set("uom", v as UnitOfMeasure)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UOMS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Units per case" htmlFor="p-upc">
                  <Input id="p-upc" type="number" min={1} value={f.unitsPerCase} onChange={(e) => set("unitsPerCase", e.target.value)} />
                </Field>
                <Field label="Weight (kg)" htmlFor="p-w" required error={errors.weightKg}>
                  <Input id="p-w" type="number" step="0.01" min={0} value={f.weightKg} onChange={(e) => set("weightKg", e.target.value)} />
                </Field>
                <Field label="Dimensions L × W × H (cm)" required error={errors.length} hint={cube > 0 ? `${(cube / 1000).toFixed(2)} L · ${(cube / 1e6).toFixed(4)} m³` : undefined} className="sm:col-span-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Input type="number" min={0} placeholder="Length" value={f.length} onChange={(e) => set("length", e.target.value)} aria-label="Length" />
                    <Input type="number" min={0} placeholder="Width" value={f.width} onChange={(e) => set("width", e.target.value)} aria-label="Width" />
                    <Input type="number" min={0} placeholder="Height" value={f.height} onChange={(e) => set("height", e.target.value)} aria-label="Height" />
                  </div>
                </Field>
                <Field label="Storage condition" className="sm:col-span-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(["ambient", "chilled", "hazmat", "high-value"] as StorageCondition[]).map((s) => (
                      <button
                        type="button"
                        key={s}
                        onClick={() => set("storage", s)}
                        className={`rounded-md border px-3 py-2 text-left text-xs capitalize transition-colors ${f.storage === s ? "border-primary bg-primary-soft text-primary" : "hover:bg-accent"}`}
                      >
                        <div className="font-medium">{s}</div>
                        <div className="text-2xs text-muted-foreground">{s === "ambient" ? "Standard racking" : s === "chilled" ? "Zone D · 2–6 °C" : s === "hazmat" ? "Segregated cage" : "Secure cage"}</div>
                      </button>
                    ))}
                  </div>
                </Field>
              </TabsContent>

              <TabsContent value="stock" forceMount className="grid gap-4 pt-4 data-[state=inactive]:hidden sm:grid-cols-3">
                <Field label="Minimum stock" htmlFor="p-min" required error={errors.minStock} hint="Triggers low-stock alerts">
                  <Input id="p-min" type="number" min={0} value={f.minStock} onChange={(e) => set("minStock", e.target.value)} />
                </Field>
                <Field label="Maximum stock" htmlFor="p-max" required error={errors.maxStock}>
                  <Input id="p-max" type="number" min={0} value={f.maxStock} onChange={(e) => set("maxStock", e.target.value)} />
                </Field>
                <Field label="Reorder quantity" htmlFor="p-roq" hint="Defaults to max − min">
                  <Input id="p-roq" type="number" min={0} value={f.reorderQty} onChange={(e) => set("reorderQty", e.target.value)} />
                </Field>
                <Field label="Unit cost (USD)" htmlFor="p-cost" required error={errors.unitCost}>
                  <Input id="p-cost" type="number" step="0.01" min={0} value={f.unitCost} onChange={(e) => set("unitCost", e.target.value)} />
                </Field>
                <Field label="Unit price (USD)" htmlFor="p-price" hint={num(f.unitCost) > 0 && num(f.unitPrice) > 0 ? `Margin ${(((num(f.unitPrice) - num(f.unitCost)) / num(f.unitPrice)) * 100).toFixed(1)}%` : "Defaults to cost × 1.5"}>
                  <Input id="p-price" type="number" step="0.01" min={0} value={f.unitPrice} onChange={(e) => set("unitPrice", e.target.value)} />
                </Field>
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save changes" : "Create product"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
