"use client";

import * as React from "react";
import { Building2, Cloud, Lock, Plug, Plus, ShieldCheck, Truck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { useInitialParam, useQueryFlag } from "@/hooks/use-query-flag";
import { cn } from "@/lib/utils";
import { RolesMatrix, UsersPanel } from "./users-panel";

const ORG_DEFAULTS = {
  company: "",
  timezone: "America/New_York",
  units: "metric",
  dateFormat: "dd MMM yyyy",
  currency: "USD",
  allocation: "FEFO",
  putaway: "Closest empty",
  autoApproveLimit: "250",
  cycleCountDays: "90",
};
type Org = typeof ORG_DEFAULTS;

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

const TIMEZONES = ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Rome", "Europe/Berlin", "UTC"];

export function SettingsView() {
  const { warehouse, warehouses, all, settings, setWarehouseId, actions, can, user, roleLabel } = useWms();
  const isAdmin = can("settings.manage");
  const initialTab = useInitialParam("tab");
  const [tab, setTab] = React.useState(initialTab ?? (isAdmin ? "general" : "profile"));
  useQueryFlag("tab", setTab);

  const savedOrg = React.useMemo<Org>(() => ({ ...ORG_DEFAULTS, ...((settings.organization as Partial<Org>) ?? {}) }), [settings.organization]);
  const [draft, setDraft] = React.useState<Org>(savedOrg);
  React.useEffect(() => setDraft(savedOrg), [savedOrg]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedOrg);
  const [savingOrg, setSavingOrg] = React.useState(false);
  const set = (k: keyof Org, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const notifs = (settings.notificationPrefs ?? {}) as Record<string, { email: boolean; app: boolean }>;
  const conns = (settings.integrations ?? {}) as Record<string, boolean>;
  const [siteOpen, setSiteOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description={isAdmin ? "Organization, sites, users and integrations" : "Your profile and notification preferences"} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {isAdmin && <TabsTrigger value="general">General</TabsTrigger>}
          <TabsTrigger value="sites">Sites</TabsTrigger>
          {isAdmin ? <TabsTrigger value="users">Users & roles</TabsTrigger> : <TabsTrigger value="users">Roles</TabsTrigger>}
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          {isAdmin && <TabsTrigger value="integrations">Integrations</TabsTrigger>}
          <TabsTrigger value="profile">My profile</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="general" className="mt-4 max-w-4xl space-y-4">
            <Card>
              <CardHeader title="Organization" description="Applies to all sites" />
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Company name">
                  <Input value={draft.company} onChange={(e) => set("company", e.target.value)} />
                </Field>
                <Field label="Default time zone">
                  <Select value={draft.timezone} onValueChange={(v) => set("timezone", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
                    <SelectContent>{["USD", "EUR", "GBP", "CAD", "MXN"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
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
                <Field label="Auto-approve adjustments under (USD)">
                  <Input type="number" min={0} value={draft.autoApproveLimit} onChange={(e) => set("autoApproveLimit", e.target.value)} />
                </Field>
                <Field label="Cycle count frequency (days)">
                  <Input type="number" min={1} value={draft.cycleCountDays} onChange={(e) => set("cycleCountDays", e.target.value)} />
                </Field>
              </CardContent>
              <CardFooter className="justify-end gap-2">
                <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(savedOrg)}>Discard</Button>
                <Button
                  disabled={!dirty || savingOrg}
                  onClick={async () => {
                    setSavingOrg(true);
                    const ok = await actions.saveSetting("organization", draft);
                    setSavingOrg(false);
                    if (ok) toast.success("Settings saved");
                  }}
                >
                  {savingOrg ? "Saving…" : "Save changes"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="sites" className="mt-4 space-y-3">
          {isAdmin && (
            <div className="flex justify-end">
              <Button onClick={() => setSiteOpen(true)}>
                <Plus /> Add site
              </Button>
            </div>
          )}
          <div className="grid gap-3 lg:grid-cols-3">
            {warehouses.map((w) => {
              const locs = all.locations.filter((l) => l.warehouseId === w.id);
              const staff = all.employees.filter((e) => e.warehouseId === w.id);
              const zones = all.zones.filter((z) => z.warehouseId === w.id);
              return (
                <Card key={w.id} className={cn(w.id === warehouse.id && "ring-1 ring-primary/40")}>
                  <CardHeader
                    title={w.name}
                    description={`${w.id} · ${w.city} · ${w.timezone}`}
                    actions={
                      w.id === warehouse.id ? (
                        <Badge tone="primary">Current</Badge>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => { setWarehouseId(w.id); toast.success(`Switched to ${w.name}`); }}>
                          Switch
                        </Button>
                      )
                    }
                  />
                  <CardContent className="space-y-3 text-[13px]">
                    <div className="grid grid-cols-3 gap-2">
                      {[["Zones", zones.length], ["Locations", locs.length], ["Staff", staff.length]].map(([k, v]) => (
                        <div key={String(k)} className="rounded-md border bg-subtle px-2.5 py-2">
                          <div className="text-2xs text-muted-foreground">{k}</div>
                          <div className="font-semibold tabular">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">{zones.map((z) => <Badge key={z.id}>{z.code} · {z.name}</Badge>)}</div>
                    {zones.length === 0 && <p className="text-xs text-muted-foreground">No layout yet. Switch to this site and use Locations → Add locations.</p>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <AddSiteDialog open={siteOpen} onOpenChange={setSiteOpen} />
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-4">{isAdmin ? <UsersPanel /> : <RolesMatrix />}</TabsContent>

        <TabsContent value="notifications" className="mt-4 max-w-3xl">
          <Card>
            <CardHeader title="Notification preferences" description="Changes save automatically." />
            <div className="divide-y">
              <div className="flex px-4 py-2 text-xs font-medium text-muted-foreground"><span className="flex-1">Event</span><span className="w-16 text-center">In-app</span><span className="w-16 text-center">Email</span></div>
              {NOTIFS.map(([k, label, desc]) => (
                <div key={k} className="flex items-center px-4 py-3">
                  <div className="flex-1"><div className="text-[13px] font-medium">{label}</div><div className="text-2xs text-muted-foreground">{desc}</div></div>
                  {(["app", "email"] as const).map((ch) => (
                    <div key={ch} className="flex w-16 justify-center">
                      <Switch
                        checked={notifs[k]?.[ch] ?? false}
                        onCheckedChange={(v) => void actions.saveSetting("notificationPrefs", { ...notifs, [k]: { ...(notifs[k] ?? { app: false, email: false }), [ch]: v } })}
                        aria-label={`${label} ${ch === "app" ? "in-app" : "email"}`}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="integrations" className="mt-4 space-y-3">
            <p className="max-w-3xl text-[13px] text-muted-foreground">These switches record which integrations are enabled. Each connector (credentials and data sync) is configured separately — see the README.</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {INTEGRATIONS.map((i) => {
                const on = !!conns[i.id];
                return (
                  <div key={i.id} className="flex flex-col rounded-lg border bg-surface p-4 shadow-card">
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 items-center justify-center rounded-md border bg-subtle"><i.icon className="size-4 text-muted-foreground" /></span>
                      <div className="min-w-0 flex-1"><div className="text-[13px] font-semibold">{i.name}</div><p className="text-xs text-muted-foreground">{i.desc}</p></div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Badge tone={on ? "success" : "neutral"} dot>{on ? "Enabled" : "Disabled"}</Badge>
                      <Button
                        size="sm"
                        variant={on ? "ghost" : "secondary"}
                        onClick={async () => {
                          if (await actions.saveSetting("integrations", { ...conns, [i.id]: !on })) toast.success(on ? `${i.name} disabled` : `${i.name} enabled`);
                        }}
                      >
                        {on ? <><Unplug /> Disable</> : <><Plug /> Enable</>}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
        )}

        <TabsContent value="profile" className="mt-4 grid max-w-4xl gap-4 lg:grid-cols-2">
          <ProfileCard key={user?.id} />
          <PasswordCard />
          <p className="text-xs text-muted-foreground lg:col-span-2">
            Signed in as <span className="font-mono">{user?.login}</span> · {roleLabel}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileCard() {
  const { user, warehouse, roleLabel, actions } = useWms();
  const initial = React.useMemo(() => ({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.profile.phone ?? "", language: user?.profile.language ?? "English (US)" }), [user]);
  const [draft, setDraft] = React.useState(initial);
  React.useEffect(() => setDraft(initial), [initial]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const [saving, setSaving] = React.useState(false);
  return (
    <Card>
      <CardHeader title="My profile" />
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={draft.name || "?"} size="lg" />
          <div><div className="text-sm font-semibold">{draft.name}</div><div className="text-xs text-muted-foreground">{roleLabel} · {warehouse.name}</div></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} autoComplete="name" /></Field>
          <Field label="Email"><Input type="email" value={draft.email} onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))} autoComplete="email" /></Field>
          <Field label="Phone"><Input value={draft.phone} onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))} autoComplete="tel" /></Field>
          <Field label="Language">
            <Select value={draft.language} onValueChange={(v) => setDraft((p) => ({ ...p, language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["English (US)", "Italiano", "Español", "Português (BR)", "Français"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" onClick={() => setDraft(initial)} disabled={!dirty}>Discard</Button>
        <Button
          disabled={!dirty || saving}
          onClick={async () => {
            setSaving(true);
            const ok = await actions.updateProfile(draft);
            setSaving(false);
            if (ok) toast.success("Profile updated");
          }}
        >
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function PasswordCard() {
  const { actions } = useWms();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirmPw, setConfirmPw] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  return (
    <Card>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (next.length < 10) return setError("New password must be at least 10 characters.");
          if (next !== confirmPw) return setError("The new passwords don't match.");
          setError(null);
          setSaving(true);
          const ok = await actions.updateProfile({ currentPassword: current, newPassword: next });
          setSaving(false);
          if (ok) {
            toast.success("Password changed");
            setCurrent("");
            setNext("");
            setConfirmPw("");
          }
        }}
      >
        <CardHeader title="Change password" description="Use at least 10 characters. A password manager is recommended." />
        <CardContent className="space-y-4">
          <input type="text" name="username" autoComplete="username" className="hidden" readOnly aria-hidden tabIndex={-1} />
          <Field label="Current password"><Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="New password"><Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Confirm new password" error={error ?? undefined}><Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={saving || !current || !next}>
            <Lock /> {saving ? "Changing…" : "Change password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function AddSiteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { actions, setWarehouseId } = useWms();
  const [code, setCode] = React.useState("");
  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [tz, setTz] = React.useState("America/New_York");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setCode("");
      setName("");
      setCity("");
      setTz("America/New_York");
      setError(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            const id = `WH-${code.trim().toUpperCase()}`;
            if (!/^WH-[A-Z0-9]{2,8}$/.test(id)) return setError("Site code must be 2–8 letters or digits, e.g. MXP.");
            if (!name.trim() || !city.trim()) return setError("Name and city are required.");
            if (await actions.createWarehouse({ id, name: name.trim(), city: city.trim(), timezone: tz })) {
              toast.success(`${name.trim()} created`, { description: "Add its zones and locations next." });
              setWarehouseId(id);
              onOpenChange(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Add site</DialogTitle>
            <DialogDescription>Create a warehouse, then build its layout in Locations.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Site code" required hint="Becomes WH-CODE and prefixes location codes">
              <div className="flex items-center gap-1.5"><span className="font-mono text-xs text-muted-foreground">WH-</span><Input value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" /></div>
            </Field>
            <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Milan Malpensa DC" /></Field>
            <Field label="City" required><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
            <Field label="Time zone">
              <Select value={tz} onValueChange={setTz}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {error && <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Create site</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
