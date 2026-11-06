"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { ActivityIcon } from "@/components/shared/activity-feed";
import { DateRangePicker, inRange, presetRange, type DateRange } from "@/components/shared/date-range-picker";
import { SEVERITY } from "@/lib/status";
import { formatDateTime, formatRelative } from "@/lib/format";
import type { ActivityEvent } from "@/types";

const MODULES = ["Inventory", "Inbound", "Outbound", "Picking", "Transfers", "Adjustments", "Products", "Locations", "Users", "System"];

export function ActivityView() {
  const { activity, warehouse } = useWms();
  const [range, setRange] = React.useState<DateRange>(presetRange("30d"));
  const data = React.useMemo(() => activity.filter((a) => inRange(a.timestamp, range)), [activity, range]);
  const counts = {
    total: data.length,
    warnings: data.filter((a) => a.severity === "warning").length,
    critical: data.filter((a) => a.severity === "critical").length,
    users: new Set(data.map((a) => a.actor)).size,
  };

  const columns: ColumnDef<ActivityEvent, unknown>[] = [
    { accessorKey: "timestamp", header: "Time", meta: { label: "Time" }, cell: ({ getValue }) => <div><div className="tabular">{formatDateTime(getValue() as string)}</div><div className="text-2xs text-muted-foreground">{formatRelative(getValue() as string)}</div></div> },
    {
      accessorKey: "action",
      header: "Event",
      meta: { label: "Event" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5">
          <ActivityIcon event={row.original} />
          <div className="min-w-0 max-w-[360px]">
            <div className="truncate font-medium">{row.original.action}</div>
            <div className="truncate text-2xs text-muted-foreground">{row.original.details}</div>
          </div>
        </div>
      ),
    },
    { accessorKey: "entity", header: "Reference", meta: { label: "Reference" }, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "module", header: "Module", meta: { label: "Module" }, filterFn: inArrayFilter, cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: "actor", header: "User", meta: { label: "User" }, filterFn: inArrayFilter, cell: ({ row }) => <div className="flex items-center gap-2"><Avatar name={row.original.actor} size="xs" /><div><div className="text-xs">{row.original.actor}</div><div className="text-2xs text-muted-foreground">{row.original.actorRole}</div></div></div> },
    { accessorKey: "source", header: "Source", meta: { label: "Source" }, filterFn: inArrayFilter, cell: ({ getValue }) => <span className="text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "severity", header: "Severity", meta: { label: "Severity" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={SEVERITY} value={row.original.severity} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Activity Logs" description={`Immutable audit trail of every transaction · ${warehouse.name}`} actions={<DateRangePicker value={range} onChange={setRange} />} />
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-4">
        {[
          ["Events", counts.total],
          ["Warnings", counts.warnings],
          ["Critical", counts.critical],
          ["Active users & systems", counts.users],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
          </div>
        ))}
      </div>
      <DataTable
        key={warehouse.id}
        columns={columns}
        data={data}
        searchPlaceholder="Search events, references, users…"
        searchText={(r) => `${r.action} ${r.details} ${r.entity} ${r.actor} ${r.module}`}
        facets={[
          { columnId: "module", title: "Module", options: MODULES.map((m) => ({ label: m, value: m })) },
          { columnId: "severity", title: "Severity", options: Object.entries(SEVERITY).map(([value, m]) => ({ label: m.label, value })) },
          { columnId: "source", title: "Source", options: ["Web", "RF Scanner", "API", "System"].map((m) => ({ label: m, value: m })) },
          { columnId: "actor", title: "User", options: [...new Set(activity.map((a) => a.actor))].sort().map((m) => ({ label: m, value: m })) },
        ]}
        initialSorting={[{ id: "timestamp", desc: true }]}
        pageSize={25}
        exportName={`activity-${warehouse.id}`}
        exportRow={(r) => ({ timestamp: r.timestamp, action: r.action, details: r.details, reference: r.entity, module: r.module, user: r.actor, role: r.actorRole, source: r.source, severity: r.severity })}
      />
    </div>
  );
}
