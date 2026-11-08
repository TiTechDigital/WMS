"use client";

import * as React from "react";
import { Building2, Check, Cloud, Plug, ShieldCheck, Truck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useWms, CURRENT_USER } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field } from "@/components/shared/form-field";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useInitialParam, useQueryFlag } from "@/hooks/use-query-flag";
import { WAREHOUSES } from "@/lib/constants";
import { LAYOUTS } from "@/data/warehouse";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  company: "Northstar Logistics",
  timezone: "America/New_York",
  units: "metric",
  dateFormat: "MMM d, yyyy",
  currency: "USD",
  allocation: "FEFO",
  putaway: "Closest empty",
  autoApproveLimit: "250",
  cycleCountDays: "90",
};

const NOTIFS = [
  ["lowStock", "Low stock & stock-outs", "When a SKU falls below its minimum"],
  ["inbound", "Inbound arrivals", "Trailer check-in and receiving discrepancies"],
  ["urgent", "Urgent orders at risk", "Urgent orders not started within 2 hours of cut-off"],
  ["adjust", "Adjustments awaiting approval", "Daily digest of pending adjustments"],
  ["digest", "Daily operations digest", "Summary email at 07:00 site time"],
] as const;

const INTEGRATIONS = [
  { id: "erp", name: "ERP — Purchase orders & invoicing", desc: "Sync POs, receipts and inventory valuation", icon: Building2 },
  { id: "shopify", name: "Shopify storefront", desc: "Import web orders and push tracking numbers", icon: Cloud },
  { id: "edi", name: "EDI 940 / 945 / 856", desc: "Retail partner order and ASN exchange via VAN", icon: Plug },
  { id: "ups", name: "UPS parcel", desc: "Rate shopping, labels and manifests", icon: Truck },
  { id: "fedex", name: "FedEx parcel", desc: "Rate shopping, labels and manifests", icon: Truck },
  { id: "sso", name: "Single sign-on (SAML)", desc: "Authenticate users with your identity provider", icon: ShieldCheck },
];

const ROLES = [
  { role: "Warehouse Manager", perms: [true, true, true, true, true] },
  { role: "Shift Supervisor", perms: [true, true, true, true, false] },
  { role: "Inventory Controller", perms: [true, true, false, true, false] },
  { role: "Receiver", perms: [true, false, false, false, false] },
  { role: "Picker / Packer", perms: [true, false, false, false, false] },
];
const PERMS = ["Execute tasks", "Edit inventory", "Release waves", "Approve adjustments", "Admin settings"];

export function SettingsView() {
  const { warehouse, all, setWarehouseId, actions } = useWms();
  const initialTab = useInitialParam("tab");
  const [tab, setTab] = React.useState(initialTab ?? "general");
  useQueryFlag("tab", setTab);
  const [saved, setSaved] = useLocalStorage("wms.settings", DEFAULTS);
  const [draft, setDraft] = React.useState(DEFAULTS);
  React.useEffect(() => setDraft(saved), [saved]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const [notifs, setNotifs] = useLocalStorage<Record<string, { email: boolean; app: boolean }>>("wms.settings.notifs", Object.fromEntries(NOTIFS.map(([k]) => [k, { email: k !== "adjust", app: true }])));
  const [conns, setConns] = useLocalStorage<Record<string, boolean>>("wms.settings.integrations", { erp: true, shopify: true, edi: true, ups: true, fedex: false, sso: false });
  const [profile, setProfile] = useLocalStorage("wms.settings.profile", { name: CURRENT_USER.name, email: CURRENT_USER.email, phone: "+1 (404) 555-0182", language: "English (US)" });
  const [profileDraft, setProfileDraft] = React.useState(profile);
  React.useEffect(() => setProfileDraft(profile), [profile]);

  const set = (k: keyof typeof DEFAULTS, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const save = () => {
    setSaved(draft);
    actions.log({ module: "System", action: "Settings updated", entity: "Site configuration", details: Object.keys(draft).filter((k) => draft[k as keyof typeof draft] !== saved[k as keyof typeof saved]).join(", ") || "No changes", severity: "info" });
    toast.success("Settings saved");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Organization, sites, users and integrations" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="profile">My profile</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 max-w-4xl space-y-4">
          <Card>
            <CardHeader title="Organization" description="Applies to all sites" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Company name"><Input value={draft.company} onChange={(e) => set("company", e.target.value)} /></Field>
              <Field label="Default time zone">
                <Select value={draft.timezone} onValueChange={(v) => set("timezone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Units of measure">
                <Select value={draft.units} onValueChange={(v) => set("units", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="metric">Metric (kg, cm)</SelectItem><SelectItem value="imperial">Imperial (lb, in)</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Currency">
                <Select value={draft.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD", "CAD", "EUR", "GBP", "MXN"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader title="Inventory rules" description="Default strategies used by allocation and putaway" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Allocation strategy" hint="How stock is reserved for orders">
                <Select value={draft.allocation} onValueChange={(v) => set("allocation", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["FEFO", "FIFO", "LIFO", "Least picks"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Putaway strategy">
                <Select value={draft.putaway} onValueChange={(v) => set("putaway", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["Closest empty", "Fixed slot", "Consolidate with same SKU", "Velocity-based"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Auto-approve adjustments under (USD)"><Input type="number" min={0} value={draft.autoApproveLimit} onChange={(e) => set("autoApproveLimit", e.target.value)} /></Field>
              <Field label="Cycle count frequency (days)"><Input type="number" min={1} value={draft.cycleCountDays} onChange={(e) => set("cycleCountDays", e.target.value)} /></Field>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(saved)}>Discard</Button>
              <Button disabled={!dirty} onClick={save}>Save changes</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="mt-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {WAREHOUSES.map((w) => {
              const locs = all.locations.filter((l) => l.warehouseId === w.id);
              const staff = all.employees.filter((e) => e.warehouseId === w.id);
              return (
                <Card key={w.id} className={cn(w.id === warehouse.id && "ring-1 ring-primary/40")}>
                  <CardHeader title={w.name} description={`${w.id} · ${w.city}`} actions={w.id === warehouse.id ? <Badge tone="primary">Current</Badge> : <Button size="sm" variant="secondary" onClick={() => { setWarehouseId(w.id); toast.success(`Switched to ${w.name}`); }}>Switch</Button>} />
                  <CardContent className="space-y-3 text-[13px]">
                    <div className="grid grid-cols-3 gap-2">
                      {[["Zones", LAYOUTS[w.id].length], ["Locations", locs.length], ["Staff", staff.length]].map(([k, v]) => (
                        <div key={String(k)} className="rounded-md border bg-subtle px-2.5 py-2"><div className="text-2xs text-muted-foreground">{k}</div><div className="font-semibold tabular">{v}</div></div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">{LAYOUTS[w.id].map((z) => <Badge key={z.code}>{z.code} · {z.name}</Badge>)}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">
          <Card>
            <CardHeader title="Role permissions" description="Default access by job function" />
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="bg-subtle text-xs text-muted-foreground">
                  <tr><th scope="col" className="px-4 py-2 text-left font-medium">Role</th>{PERMS.map((p) => <th key={p} scope="col" className="px-4 py-2 text-center font-medium">{p}</th>)}</tr>
                </thead>
                <tbody>
                  {ROLES.map((r) => (
                    <tr key={r.role} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{r.role}</td>
                      {r.perms.map((p, i) => <td key={i} className="px-4 py-2.5 text-center">{p ? <Check className="mx-auto size-4 text-success-text" /> : <span className="text-muted-foreground">—</span>}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Card>
            <CardHeader title="Users with admin access" description="Managers and supervisors across all sites" />
            <div className="divide-y">
              {all.employees.filter((e) => e.role === "Warehouse Manager" || e.role === "Shift Supervisor").map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Avatar name={e.name} size="sm" />
                  <div className="min-w-0 flex-1"><div className="text-[13px] font-medium">{e.name}</div><div className="text-2xs text-muted-foreground">{e.email}</div></div>
                  <Badge>{e.role}</Badge>
                  <Badge tone="primary">{e.warehouseId}</Badge>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4 max-w-3xl">
          <Card>
            <CardHeader title="Notification preferences" description="Choose how you’re alerted. Changes save automatically." />
            <div className="divide-y">
              <div className="flex px-4 py-2 text-xs font-medium text-muted-foreground"><span className="flex-1">Event</span><span className="w-16 text-center">In-app</span><span className="w-16 text-center">Email</span></div>
              {NOTIFS.map(([k, label, desc]) => (
                <div key={k} className="flex items-center px-4 py-3">
                  <div className="flex-1"><div className="text-[13px] font-medium">{label}</div><div className="text-2xs text-muted-foreground">{desc}</div></div>
                  {(["app", "email"] as const).map((ch) => (
                    <div key={ch} className="flex w-16 justify-center">
                      <Switch checked={notifs[k]?.[ch] ?? false} onCheckedChange={(v) => setNotifs((n) => ({ ...n, [k]: { ...(n[k] ?? { app: false, email: false }), [ch]: v } }))} aria-label={`${label} ${ch}`} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {INTEGRATIONS.map((i) => {
              const on = conns[i.id];
              return (
                <div key={i.id} className="flex flex-col rounded-lg border bg-surface p-4 shadow-card">
                  <div className="flex items-start gap-3">
                    <span className="flex size-9 items-center justify-center rounded-md border bg-subtle"><i.icon className="size-4 text-muted-foreground" /></span>
                    <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{i.name}</div><p className="text-xs text-muted-foreground">{i.desc}</p></div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Badge tone={on ? "success" : "neutral"} dot>{on ? "Connected" : "Not connected"}</Badge>
                    <Button
                      size="sm"
                      variant={on ? "ghost" : "secondary"}
                      onClick={() => {
                        setConns((c) => ({ ...c, [i.id]: !on }));
                        actions.log({ module: "System", action: on ? "Integration disconnected" : "Integration connected", entity: i.name, details: on ? "Sync paused" : "Credentials verified", severity: on ? "warning" : "success" });
                        toast.success(on ? `${i.name} disconnected` : `${i.name} connected`);
                      }}
                    >
                      {on ? <><Unplug /> Disconnect</> : <><Plug /> Connect</>}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="profile" className="mt-4 max-w-2xl">
          <Card>
            <CardHeader title="My profile" />
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={profileDraft.name} size="lg" />
                <div><div className="text-sm font-semibold">{profileDraft.name}</div><div className="text-xs text-muted-foreground">{CURRENT_USER.role} · {warehouse.name}</div></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><Input value={profileDraft.name} onChange={(e) => setProfileDraft((p) => ({ ...p, name: e.target.value }))} /></Field>
                <Field label="Email"><Input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft((p) => ({ ...p, email: e.target.value }))} /></Field>
                <Field label="Phone"><Input value={profileDraft.phone} onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))} /></Field>
                <Field label="Language">
                  <Select value={profileDraft.language} onValueChange={(v) => setProfileDraft((p) => ({ ...p, language: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["English (US)", "Español", "Português (BR)", "Français"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button variant="ghost" onClick={() => setProfileDraft(profile)} disabled={JSON.stringify(profile) === JSON.stringify(profileDraft)}>Discard</Button>
              <Button onClick={() => { setProfile(profileDraft); toast.success("Profile updated"); }} disabled={JSON.stringify(profile) === JSON.stringify(profileDraft)}>Save profile</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

