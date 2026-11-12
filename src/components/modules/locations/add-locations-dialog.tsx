"use client";

import * as React from "react";
import { toast } from "sonner";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/shared/form-field";
import { useWms } from "@/store/wms-store";
import { LOCATION_TYPE_LABEL } from "@/lib/status";
import { formatNumber } from "@/lib/format";

const LEVELS = "ABCDEFGHIJKL".split("");
const NEW_ZONE = "__new";
const p2 = (n: number) => String(n).padStart(2, "0");

/**
 * Generates storage positions for a zone: every aisle × rack × level × bin combination,
 * coded <SITE>-<ZONE>-<AISLE>-<RACK>-<LEVEL>-<BIN> (e.g. ATL-E-01-03-B-01).
 */
export function AddLocationsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { zones, warehouse, actions } = useWms();
  const storageZones = zones.filter((z) => z.type !== "dock");
  const [zoneCode, setZoneCode] = React.useState(NEW_ZONE);
  const [newCode, setNewCode] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("pick-bin");
  const [temperature, setTemperature] = React.useState("");
  const [aisles, setAisles] = React.useState<[string, string]>(["1", "2"]);
  const [racks, setRacks] = React.useState<[string, string]>(["1", "6"]);
  const [levelCount, setLevelCount] = React.useState("4");
  const [bins, setBins] = React.useState("1");
  const [capacity, setCapacity] = React.useState("120");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setZoneCode(NEW_ZONE);
    const used = new Set(zones.map((z) => z.code));
    setNewCode("ABCDEFGHJKLMNPQTUVWXYZ".split("").find((c) => !used.has(c)) ?? "");
    setNewName("");
    setNewType("pick-bin");
    setTemperature("");
    setAisles(["1", "2"]);
    setRacks(["1", "6"]);
    setLevelCount("4");
    setBins("1");
    setCapacity("120");
    setError(null);
  }, [open, zones]);

  const existing = storageZones.find((z) => z.code === zoneCode);
  const code = existing ? existing.code : newCode.trim().toUpperCase();
  const type = existing ? existing.type : newType;
  const a = aisles.map(Number) as [number, number];
  const r = racks.map(Number) as [number, number];
  const levels = LEVELS.slice(0, Math.max(0, Math.min(12, Number(levelCount) || 0)));
  const nBins = Number(bins) || 0;
  const count = a[1] >= a[0] && r[1] >= r[0] ? (a[1] - a[0] + 1) * (r[1] - r[0] + 1) * levels.length * nBins : 0;
  const site = warehouse.id.replace(/^WH-/, "");
  const first = count ? `${site}-${code || "?"}-${p2(a[0])}-${p2(r[0])}-${levels[0]}-01` : "—";
  const last = count ? `${site}-${code || "?"}-${p2(a[1])}-${p2(r[1])}-${levels[levels.length - 1]}-${p2(nBins)}` : "—";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!existing) {
      if (!/^[A-Z0-9]{1,3}$/.test(code)) return setError("Zone code must be 1–3 uppercase letters or digits.");
      if (zones.some((z) => z.code === code)) return setError(`Zone ${code} already exists — pick it from the list instead.`);
      if (!newName.trim()) return setError("Give the new zone a name.");
    }
    if (![...a, ...r].every((n) => Number.isInteger(n) && n >= 1 && n <= 99)) return setError("Aisle and rack numbers must be between 1 and 99.");
    if (a[0] > a[1] || r[0] > r[1]) return setError("Each range must start before it ends.");
    if (!count) return setError("These settings don't create any locations.");
    if (count > 5000) return setError(`That's ${formatNumber(count)} locations. Create at most 5,000 at a time.`);
    if (!(Number(capacity) >= 1)) return setError("Capacity must be at least 1 unit.");
    setSaving(true);
    const res = await actions.createLocations({
      zone: { code, name: existing ? existing.name : newName.trim(), type, temperature: existing ? existing.temperature : temperature.trim() || undefined },
      aisles: a,
      racks: r,
      levels,
      binsPerLevel: nBins,
      capacity: Number(capacity),
    });
    setSaving(false);
    if (!res) return;
    toast.success(`${formatNumber(res.created)} locations created in zone ${code}`, { description: res.skipped ? `${res.skipped} already existed and were skipped` : undefined });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>Add locations</DialogTitle>
            <DialogDescription>Generate storage positions for {warehouse.name}. Existing codes are skipped, so it&apos;s safe to extend a zone.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Zone" className="sm:col-span-2">
                <Select value={zoneCode} onValueChange={setZoneCode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NEW_ZONE}>New zone…</SelectItem>
                    {storageZones.map((z) => (
                      <SelectItem key={z.id} value={z.code}>
                        {z.code} · {z.name} ({LOCATION_TYPE_LABEL[z.type]})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {!existing && (
                <>
                  <Field label="Zone code" htmlFor="z-code" required hint="1–3 characters, e.g. E">
                    <Input id="z-code" value={newCode} maxLength={3} onChange={(e) => setNewCode(e.target.value.toUpperCase())} className="font-mono" />
                  </Field>
                  <Field label="Zone name" htmlFor="z-name" required>
                    <Input id="z-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Mezzanine Pick" />
                  </Field>
                  <Field label="Storage type">
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["pick-bin", "pallet", "cold", "bulk", "staging"] as const).map((t) => (
                          <SelectItem key={t} value={t}>
                            {LOCATION_TYPE_LABEL[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Temperature (optional)" htmlFor="z-temp" hint="For cold zones, e.g. 2–6 °C">
                    <Input id="z-temp" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
                  </Field>
                </>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Aisles (from – to)" htmlFor="a-from">
                <div className="flex items-center gap-1.5">
                  <Input id="a-from" type="number" min={1} max={99} value={aisles[0]} onChange={(e) => setAisles([e.target.value, aisles[1]])} />
                  <span aria-hidden>–</span>
                  <Input type="number" min={1} max={99} value={aisles[1]} onChange={(e) => setAisles([aisles[0], e.target.value])} aria-label="Aisles to" id="a-to" />
                </div>
              </Field>
              <Field label="Racks per aisle (from – to)" htmlFor="r-from">
                <div className="flex items-center gap-1.5">
                  <Input id="r-from" type="number" min={1} max={99} value={racks[0]} onChange={(e) => setRacks([e.target.value, racks[1]])} />
                  <span aria-hidden>–</span>
                  <Input type="number" min={1} max={99} value={racks[1]} onChange={(e) => setRacks([racks[0], e.target.value])} aria-label="Racks to" id="r-to" />
                </div>
              </Field>
              <Field label="Levels per rack" htmlFor="lv" hint={levels.length ? `Shelves ${levels[0]}–${levels[levels.length - 1]}` : undefined}>
                <Input id="lv" type="number" min={1} max={12} value={levelCount} onChange={(e) => setLevelCount(e.target.value)} />
              </Field>
              <Field label="Bins per level" htmlFor="bins">
                <Input id="bins" type="number" min={1} max={20} value={bins} onChange={(e) => setBins(e.target.value)} />
              </Field>
              <Field label="Capacity per location (units)" htmlFor="cap" className="sm:col-span-2">
                <Input id="cap" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </Field>
            </div>
            <div className="rounded-md border bg-subtle px-3 py-2.5 text-[13px]" aria-live="polite">
              <div className="font-medium">
                {formatNumber(count)} location{count === 1 ? "" : "s"} · {type ? LOCATION_TYPE_LABEL[type] : ""}
              </div>
              <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                {first} … {last}
              </div>
            </div>
            {error && (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !count}>
              {saving ? "Creating…" : `Create ${formatNumber(count)} locations`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
