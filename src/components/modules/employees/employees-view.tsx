"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Coffee, LogIn, LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { useWms, nowIso } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DescriptionList, SectionTitle } from "@/components/shared/description-list";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { Field } from "@/components/shared/form-field";
import { EMPLOYEE_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import type { Employee, EmployeeRole } from "@/types";

const ROLES: EmployeeRole[] = ["Picker", "Packer", "Receiver", "Forklift Operator", "Inventory Controller", "Shift Supervisor", "Warehouse Manager"];
const SHIFTS: Employee["shift"][] = ["Morning", "Afternoon", "Night"];
const SHIFT_HOURS: Record<Employee["shift"], string> = { Morning: "06:00–14:30", Afternoon: "14:00–22:30", Night: "22:00–06:30" };

export function EmployeesView() {
  const { employees, pickTasks, activity, warehouse, actions } = useWms();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const sel = employees.find((e) => e.id === openId);
  const onShift = employees.filter((e) => e.status === "on_shift" || e.status === "on_break");
  const floor = employees.filter((e) => e.unitsPerHour > 0);

  const setStatus = (e: Employee, status: Employee["status"]) => {
    actions.setEmployeeStatus(e.id, status);
    toast.success(`${e.name} · ${EMPLOYEE_STATUS[status].label}`);
  };

  const columns: ColumnDef<Employee, unknown>[] = [
    {
      accessorKey: "name",
      header: "Operator",
      meta: { label: "Operator" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.original.name} size="sm" />
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="font-mono text-2xs text-muted-foreground">{row.original.badge}</div>
          </div>
        </div>
      ),
    },
    { accessorKey: "role", header: "Role", meta: { label: "Role" }, filterFn: inArrayFilter },
    { accessorKey: "shift", header: "Shift", meta: { label: "Shift" }, filterFn: inArrayFilter, cell: ({ row }) => <div><div>{row.original.shift}</div><div className="text-2xs text-muted-foreground tabular">{SHIFT_HOURS[row.original.shift]}</div></div> },
    { accessorKey: "zone", header: "Zone", meta: { label: "Zone" }, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={EMPLOYEE_STATUS} value={row.original.status} /> },
    {
      accessorKey: "unitsPerHour",
      header: "Productivity",
      meta: { label: "Productivity" },
      cell: ({ row }) =>
        row.original.unitsPerHour ? (
          <div className="flex w-32 items-center gap-2">
            <Progress value={(row.original.unitsPerHour / 170) * 100} size="xs" className="flex-1" />
            <span className="w-14 text-right text-xs tabular">{row.original.unitsPerHour} u/h</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { accessorKey: "accuracy", header: "Accuracy", meta: { align: "right", label: "Accuracy" }, cell: ({ getValue }) => `${(getValue() as number).toFixed(2)}%` },
    { accessorKey: "tasksToday", header: "Tasks today", meta: { align: "right", label: "Tasks today" } },
    { accessorKey: "device", header: "Device", meta: { label: "Device" }, cell: ({ getValue }) => (getValue() ? <span className="font-mono text-2xs">{getValue() as string}</span> : <span className="text-muted-foreground">—</span>) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Employees & Operators" description={`Workforce, shifts and productivity · ${warehouse.name}`} actions={<Button onClick={() => setAddOpen(true)}><Plus /> Add operator</Button>} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Headcount", `${employees.length}`, `${employees.filter((e) => e.status === "on_leave").length} on leave`],
          ["On the floor", `${onShift.length}`, `${employees.filter((e) => e.status === "on_break").length} on break`],
          ["Avg. productivity", `${Math.round(floor.reduce((s, e) => s + e.unitsPerHour, 0) / (floor.length || 1))} u/h`, "floor roles"],
          ["Avg. accuracy", `${(employees.reduce((s, e) => s + e.accuracy, 0) / (employees.length || 1)).toFixed(2)}%`, "scan-verified"],
        ].map(([k, v, h]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
            <div className="text-2xs text-muted-foreground">{h}</div>
          </div>
        ))}
      </div>
      <DataTable
        key={warehouse.id}
        columns={columns}
        data={employees}
        searchPlaceholder="Search name, badge, role…"
        searchText={(r) => `${r.name} ${r.badge} ${r.role} ${r.zone} ${r.device ?? ""}`}
        facets={[
          { columnId: "role", title: "Role", options: ROLES.map((r) => ({ label: r, value: r })) },
          { columnId: "shift", title: "Shift", options: SHIFTS.map((r) => ({ label: r, value: r })) },
          { columnId: "status", title: "Status", options: Object.entries(EMPLOYEE_STATUS).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        exportName={`employees-${warehouse.id}`}
        exportRow={(r) => ({ badge: r.badge, name: r.name, role: r.role, shift: r.shift, zone: r.zone, status: r.status, units_per_hour: r.unitsPerHour, accuracy: r.accuracy, tasks_today: r.tasksToday })}
      />
      <Sheet open={!!sel} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent width="md">
          {sel && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar name={sel.name} size="lg" />
                  <div>
                    <SheetTitle>{sel.name}</SheetTitle>
                    <SheetDescription>{sel.role} · <span className="font-mono">{sel.badge}</span></SheetDescription>
                    <div className="mt-1"><StatusBadge map={EMPLOYEE_STATUS} value={sel.status} /></div>
                  </div>
                </div>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-3 gap-2">
                  {[["Units / hour", sel.unitsPerHour || "—"], ["Accuracy", `${sel.accuracy.toFixed(1)}%`], ["Tasks today", sel.tasksToday]].map(([k, v]) => (
                    <div key={String(k)} className="rounded-md border bg-subtle px-3 py-2"><div className="text-2xs text-muted-foreground">{k}</div><div className="text-base font-semibold tabular">{v}</div></div>
                  ))}
                </div>
                <div>
                  <SectionTitle>Assignment</SectionTitle>
                  <DescriptionList items={[["Shift", `${sel.shift} · ${SHIFT_HOURS[sel.shift]}`], ["Zone", sel.zone], ["RF device", sel.device ?? "—"], ["Email", sel.email], ["Hired", formatDate(sel.hiredAt)], ["Open pick tasks", pickTasks.filter((t) => t.assigneeId === sel.id && t.status !== "completed").length]]} />
                </div>
                <div>
                  <SectionTitle>Certifications</SectionTitle>
                  <div className="flex flex-wrap gap-1.5">{sel.certifications.map((c) => <Badge key={c} tone="primary">{c}</Badge>)}</div>
                </div>
                <div>
                  <SectionTitle>Recent activity</SectionTitle>
                  {activity.filter((a) => a.actor === sel.name).length ? <ActivityFeed events={activity.filter((a) => a.actor === sel.name).slice(0, 6)} /> : <p className="text-xs text-muted-foreground">No transactions recorded today.</p>}
                </div>
              </SheetBody>
              <SheetFooter>
                {sel.status !== "on_shift" && <Button variant="secondary" onClick={() => setStatus(sel, "on_shift")}><LogIn /> Clock in</Button>}
                {sel.status === "on_shift" && <Button variant="secondary" onClick={() => setStatus(sel, "on_break")}><Coffee /> Start break</Button>}
                {(sel.status === "on_shift" || sel.status === "on_break") && <Button variant="secondary" onClick={() => setStatus(sel, "off_shift")}><LogOut /> Clock out</Button>}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
      <AddOperatorDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddOperatorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { all, warehouse, actions } = useWms();
  const [name, setName] = React.useState("");
  const [role, setRole] = React.useState<EmployeeRole>("Picker");
  const [shift, setShift] = React.useState<Employee["shift"]>("Morning");
  const [zone, setZone] = React.useState("Zone A");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (open) {
      setName("");
      setRole("Picker");
      setShift("Morning");
      setZone("Zone A");
      setError(null);
    }
  }, [open]);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().split(" ").length < 2) return setError("Enter first and last name.");
    const n = all.employees.length;
    const emp: Employee = {
      id: `emp_${Date.now().toString(36)}`,
      badge: `${warehouse.id.slice(3)}-${1040 + n * 3}`,
      name: name.trim(),
      email: `${name.trim().toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/, ".")}@northstar-logistics.com`,
      role,
      warehouseId: warehouse.id,
      shift,
      zone,
      status: "off_shift",
      unitsPerHour: 0,
      accuracy: 100,
      tasksToday: 0,
      certifications: [],
      device: ["Picker", "Packer", "Receiver", "Forklift Operator"].includes(role) ? `RF-${300 + n}` : undefined,
      hiredAt: nowIso(),
    };
    actions.upsertEmployee(emp);
    toast.success(`${emp.name} added`, { description: `Badge ${emp.badge}${emp.device ? ` · device ${emp.device}` : ""}` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <DialogHeader>
            <DialogTitle>Add operator</DialogTitle>
            <DialogDescription>A badge and RF device are issued automatically for {warehouse.name}.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field label="Full name" required><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
            <Field label="Role">
              <Select value={role} onValueChange={(v) => setRole(v as EmployeeRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Shift">
                <Select value={shift} onValueChange={(v) => setShift(v as Employee["shift"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SHIFTS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </Field>
              <Field label="Home zone">
                <Select value={zone} onValueChange={setZone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Zone A", "Zone B", "Zone C", "Zone D", "Receiving", "Pack Station", "All Zones"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
              </Field>
            </div>
            {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Add operator</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
