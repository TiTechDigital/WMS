"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Plus, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useWms, type UserAccount } from "@/store/wms-store";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/shared/form-field";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, can as canRole, type Permission, type Role } from "@/lib/permissions";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const ALL_SITES = "__all";

const MATRIX: [string, Permission][] = [
  ["Execute floor tasks", "tasks.execute"],
  ["Approve adjustments", "adjustments.approve"],
  ["Manage orders & waves", "orders.manage"],
  ["Edit products & partners", "products.manage"],
  ["Create / delete locations", "locations.manage"],
  ["Switch sites", "sites.switch"],
  ["Users & system settings", "users.manage"],
];

export function RolesMatrix() {
  return (
    <Card>
      <CardHeader title="Role permissions" description="Enforced by the server on every request." />
      <div className="overflow-x-auto" role="region" aria-label="Role permissions" tabIndex={0}>
        <table className="w-full text-[13px]">
          <caption className="sr-only">Permissions by role</caption>
          <thead className="bg-subtle text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 text-left font-medium">
                Role
              </th>
              {MATRIX.map(([label]) => (
                <th key={label} scope="col" className="px-3 py-2 text-center font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...ROLES].reverse().map((r) => (
              <tr key={r} className="border-t">
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  {ROLE_LABEL[r]}
                  <div className="text-2xs font-normal text-muted-foreground">{ROLE_DESCRIPTION[r]}</div>
                </th>
                {MATRIX.map(([label, p]) => (
                  <td key={label} className="px-3 py-2.5 text-center">
                    {canRole(r, p) ? <span className="text-success-text" aria-label="Allowed">✓</span> : <span className="text-muted-foreground" aria-label="Not allowed">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function UsersPanel() {
  const { users, warehouses, user: me, actions } = useWms();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserAccount | null>(null);
  const [resetting, setResetting] = React.useState<UserAccount | null>(null);
  const { confirm, dialog } = useConfirm();
  const siteName = (id: string | null) => (id ? warehouses.find((w) => w.id === id)?.name ?? id : "All sites");

  const toggleActive = (u: UserAccount) =>
    confirm({
      title: u.active ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`,
      description: u.active ? "They're signed out on their next request and can't sign in until reactivated. Their history is kept." : "They can sign in again with their existing password.",
      confirmLabel: u.active ? "Deactivate" : "Reactivate",
      tone: u.active ? "danger" : "default",
      onConfirm: async () => {
        if (await actions.updateUser(u.id, { active: !u.active })) toast.success(u.active ? `${u.name} deactivated` : `${u.name} reactivated`);
      },
    });

  const columns: ColumnDef<UserAccount, unknown>[] = [
    {
      accessorKey: "name",
      header: "User",
      meta: { label: "User" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.name} size="sm" />
          <div>
            <div className="font-medium">
              {row.original.name} {row.original.id === me?.id && <Badge tone="primary">You</Badge>}
            </div>
            <div className="text-2xs text-muted-foreground">{row.original.email}</div>
          </div>
        </div>
      ),
    },
    { accessorKey: "login", header: "Sign-in ID", meta: { label: "Sign-in ID" }, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "role", header: "Role", meta: { label: "Role" }, filterFn: inArrayFilter, cell: ({ row }) => <Badge tone={row.original.role === "admin" ? "dark" : row.original.role === "operator" ? "neutral" : "primary"}>{ROLE_LABEL[row.original.role]}</Badge> },
    { id: "site", header: "Site access", meta: { label: "Site access" }, accessorFn: (r) => siteName(r.warehouseId), cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "lastLoginAt", header: "Last sign-in", meta: { label: "Last sign-in" }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() ? formatRelative(getValue() as string) : "Never"}</span> },
    { accessorKey: "active", header: "Status", meta: { label: "Status" }, cell: ({ row }) => <Badge tone={row.original.active ? "success" : "neutral"} dot>{row.original.active ? "Active" : "Deactivated"}</Badge> },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setResetting(u); }}>
              <KeyRound /> Reset password
            </Button>
            {u.id !== me?.id && (
              <Button size="icon-sm" variant="ghost" aria-label={u.active ? `Deactivate ${u.name}` : `Reactivate ${u.name}`} onClick={(e) => { e.stopPropagation(); toggleActive(u); }}>
                {u.active ? <UserX /> : <UserCheck />}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">{users.length} accounts · click a row to change role or site access</p>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus /> Add user
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={users}
        caption="User accounts"
        searchPlaceholder="Search name, sign-in ID or email…"
        searchText={(u) => `${u.name} ${u.login} ${u.email}`}
        facets={[{ columnId: "role", title: "Role", options: ROLES.map((r) => ({ label: ROLE_LABEL[r], value: r })) }]}
        onRowClick={(u) => setEditing(u)}
        getRowId={(u) => u.id}
        rowClassName={(u) => (u.active ? undefined : "opacity-60")}
        pageSize={10}
      />
      <RolesMatrix />
      <UserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <UserDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} user={editing ?? undefined} />
      <ResetPasswordDialog user={resetting} onOpenChange={(o) => !o && setResetting(null)} />
      {dialog}
    </div>
  );
}

function UserDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (v: boolean) => void; user?: UserAccount }) {
  const { warehouses, user: me, actions } = useWms();
  const [name, setName] = React.useState("");
  const [login, setLogin] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("operator");
  const [site, setSite] = React.useState<string>(ALL_SITES);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const isEdit = !!user;
  const isSelf = user?.id === me?.id;

  React.useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setLogin(user?.login ?? "");
    setEmail(user?.email ?? "");
    setRole(user?.role ?? "operator");
    setSite(user ? user.warehouseId ?? ALL_SITES : warehouses[0]?.id ?? ALL_SITES);
    setPassword("");
    setError(null);
  }, [open, user, warehouses]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || (!isEdit && !login.trim())) return setError("Name, sign-in ID and email are required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (!isEdit && password.length < 10) return setError("Initial password must be at least 10 characters.");
    if ((role === "operator" || role === "supervisor") && site === ALL_SITES) return setError("Operators and supervisors must belong to a site.");
    setSaving(true);
    const warehouseId = site === ALL_SITES ? null : site;
    const res = isEdit
      ? await actions.updateUser(user!.id, { name: name.trim(), email: email.trim(), ...(isSelf ? {} : { role }), warehouseId })
      : await actions.createUser({ login: login.trim(), email: email.trim(), name: name.trim(), role, warehouseId, password });
    setSaving(false);
    if (!res) return;
    toast.success(isEdit ? "User updated" : `${name.trim()} can now sign in`, { description: isEdit ? undefined : `Sign-in ID: ${login.trim()}` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? `Edit ${user!.name}` : "Add user"}</DialogTitle>
            <DialogDescription>{isEdit ? "Role and site changes apply on the user's next request." : "Give the person a sign-in ID (e.g. their badge) and a temporary password."}</DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required className="sm:col-span-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Sign-in ID" required hint={isEdit ? "Can't be changed" : "Badge number or short username"}>
              <Input value={login} onChange={(e) => setLogin(e.target.value)} disabled={isEdit} className="font-mono" autoComplete="off" />
            </Field>
            <Field label="Email" required>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
            <Field label="Role" hint={isSelf ? "You can't change your own role" : ROLE_DESCRIPTION[role]}>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={isSelf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Site access" hint="Managers and admins can switch between all sites">
              <Select value={site} onValueChange={setSite}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_SITES}>All sites (home: none)</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {!isEdit && (
              <Field label="Temporary password" required hint="At least 10 characters. Ask them to change it in My profile." className="sm:col-span-2">
                <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" />
              </Field>
            )}
            {error && (
              <p role="alert" className={cn("rounded-md bg-danger-soft px-3 py-2 text-xs text-danger-text sm:col-span-2")}>
                {error}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onOpenChange }: { user: UserAccount | null; onOpenChange: (v: boolean) => void }) {
  const { actions } = useWms();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setPassword("");
    setError(null);
  }, [user]);
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 10) return setError("Password must be at least 10 characters.");
            if (await actions.updateUser(user!.id, { password })) {
              toast.success(`Password reset for ${user!.name}`, { description: "Share it with them securely." });
              onOpenChange(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>{user?.name} · {user?.login}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <Field label="New temporary password" required error={error ?? undefined}>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Reset password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
