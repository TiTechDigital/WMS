"use client";

import * as React from "react";
import { Boxes, ScanLine, Timer, Users, Zap } from "lucide-react";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PickConsole } from "./pick-console";
import { PackStation } from "./pack-station";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { PRIORITY, TASK_STATUS } from "@/lib/status";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PickTask } from "@/types";

export function PickingView() {
  const { pickTasks, orders, employees, metrics, warehouse } = useWms();
  const [tab, setTab] = React.useState("pick");
  const [filter, setFilter] = React.useState<"active" | "queued" | "in_progress" | "completed">("active");
  const [zone, setZone] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  useQueryFlag("task", (id) => {
    setTab("pick");
    setFilter("active");
    setSelectedId(id);
  });

  const zones = [...new Set(pickTasks.map((t) => t.zone))].sort();
  const list = pickTasks
    .filter((t) => (filter === "active" ? t.status !== "completed" : t.status === filter || (filter === "in_progress" && t.status === "paused")))
    .filter((t) => zone === "all" || t.zone === zone)
    .filter((t) => !q || `${t.id} ${t.orderId} ${t.customerName} ${t.assigneeName ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.status === "in_progress" ? -1 : 0) - (b.status === "in_progress" ? -1 : 0) || PRIORITY[b.priority].rank - PRIORITY[a.priority].rank || a.dueAt.localeCompare(b.dueAt));

  const selected = pickTasks.find((t) => t.id === selectedId) ?? list[0];
  const openUnits = pickTasks.filter((t) => t.status !== "completed").reduce((s, t) => s + t.lines.reduce((a, l) => a + l.quantity - l.picked, 0), 0);
  const pickersActive = new Set(pickTasks.filter((t) => t.status === "in_progress").map((t) => t.assigneeId)).size;
  const last = metrics.at(-1);

  const stats = [
    { icon: ScanLine, label: "Open pick tasks", value: pickTasks.filter((t) => t.status !== "completed").length },
    { icon: Boxes, label: "Units to pick", value: openUnits.toLocaleString("en-US") },
    { icon: Users, label: "Pickers active", value: `${pickersActive} / ${employees.filter((e) => e.role === "Picker" && e.status === "on_shift").length}` },
    { icon: Zap, label: "Pick rate", value: `${last?.pickRate ?? 0} u/h` },
    { icon: Timer, label: "Avg. pick time", value: `${last?.avgPickMinutes ?? 0} min` },
    { icon: Boxes, label: "Awaiting pack", value: orders.filter((o) => o.status === "packing").length },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Picking & Packing"
        description={`Operator task execution · ${warehouse.name}`}
        actions={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="segmented">
              <TabsTrigger value="pick">
                <ScanLine /> Picking
              </TabsTrigger>
              <TabsTrigger value="pack">
                <Boxes /> Pack station
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3 bg-surface px-4 py-3">
            <s.icon className="size-4 text-muted-foreground" />
            <div>
              <div className="text-2xs text-muted-foreground">{s.label}</div>
              <div className="text-base font-semibold tabular">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="pick" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
            <div className="flex flex-col overflow-hidden rounded-lg border bg-surface shadow-card">
              <div className="space-y-2 border-b p-3">
                <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                  <TabsList variant="segmented" className="w-full">
                    {(
                      [
                        ["active", "Active"],
                        ["queued", "Queued"],
                        ["in_progress", "Running"],
                        ["completed", "Done"],
                      ] as const
                    ).map(([k, l]) => (
                      <TabsTrigger key={k} value={k} className="flex-1">
                        {l}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="flex gap-2">
                  <Input type="search" aria-label="Search pick tasks by task, order or picker" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Task, order, picker…" />
                  <Select value={zone} onValueChange={setZone}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All zones</SelectItem>
                      {zones.map((z) => (
                        <SelectItem key={z} value={z}>
                          Zone {z}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="scrollbar-thin max-h-[720px] flex-1 overflow-y-auto">
                {list.map((t) => (
                  <TaskRow key={t.id} t={t} active={selected?.id === t.id} onClick={() => setSelectedId(t.id)} />
                ))}
                {list.length === 0 && <EmptyState icon={ScanLine} title="No tasks match" description="Change the filter or release a new wave from Outbound." />}
              </div>
            </div>
            <div>{selected ? <PickConsole key={selected.id} task={selected} /> : <div className="rounded-lg border bg-surface"><EmptyState title="Select a task" /></div>}</div>
          </div>
        </TabsContent>
        <TabsContent value="pack" className="mt-0">
          <PackStation />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TaskRow({ t, active, onClick }: { t: PickTask; active: boolean; onClick: () => void }) {
  const qty = t.lines.reduce((s, l) => s + l.quantity, 0);
  const picked = t.lines.reduce((s, l) => s + l.picked, 0);
  return (
    <button onClick={onClick} className={cn("relative block w-full border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-subtle", active && "bg-primary-soft/60 hover:bg-primary-soft/60")}>
      {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-semibold">{t.orderId}</span>
        <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
        <span className="ml-auto">
          <StatusBadge map={TASK_STATUS} value={t.status} />
        </span>
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {t.customerName} · Zone {t.zone} · {t.lines.length} SKU{t.lines.length === 1 ? "" : "s"}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={(picked / qty) * 100} size="xs" className="flex-1" tone={t.status === "completed" ? "success" : t.status === "paused" ? "warning" : "primary"} />
        <span className="text-2xs tabular text-muted-foreground">
          {picked}/{qty}
        </span>
      </div>
      <div className="mt-1.5 flex justify-between text-2xs text-muted-foreground">
        <span>{t.assigneeName ?? "Unassigned"}</span>
        <span>due {formatRelative(t.dueAt)}</span>
      </div>
    </button>
  );
}
