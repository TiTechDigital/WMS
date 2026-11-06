"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardCheck, PackageCheck, PackageOpen, Plus, Truck, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageFlow } from "@/components/shared/stage-flow";
import { StatusBadge } from "@/components/shared/status-badge";
import { InboundDrawer } from "./inbound-drawer";
import { NewAsnDialog } from "./new-asn-dialog";
import { NEXT_ACTION, shipmentTotals } from "./inbound-shared";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { INBOUND_STATUS, PRIORITY } from "@/lib/status";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { REFERENCE_NOW } from "@/lib/constants";
import { INBOUND_STAGES, type InboundShipment, type InboundStatus } from "@/types";

const STAGE_ICONS: Record<InboundStatus, React.ElementType> = {
  expected: CalendarClock,
  arrived: Truck,
  receiving: PackageOpen,
  quality_check: ClipboardCheck,
  putaway: Warehouse,
  completed: CheckCircle2,
};

type Row = InboundShipment & { units: number; received: number; variance: number; damaged: number; counted: boolean };

export function InboundView() {
  const { inbound, warehouse, actions } = useWms();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<string | null>(null);
  const [window_, setWindow] = React.useState<"open" | "today" | "week" | "all">("open");
  const [newOpen, setNewOpen] = React.useState(false);
  const [presetSku, setPresetSku] = React.useState<string | undefined>();

  useQueryFlag("id", (id) => setOpenId(id));
  useQueryFlag("sku", (sku) => setPresetSku(sku));
  useQueryFlag("new", () => setNewOpen(true));

  const today = REFERENCE_NOW.toISOString().slice(0, 10);
  const weekEnd = new Date(REFERENCE_NOW.getTime() + 7 * 86400000).toISOString();

  const rows = React.useMemo<Row[]>(
    () =>
      inbound.map((s) => {
        const t = shipmentTotals(s);
        return { ...s, units: t.expected, received: t.received, variance: t.variance, damaged: t.damaged, counted: t.counted };
      }),
    [inbound]
  );

  const windowed = rows.filter((s) =>
    window_ === "open" ? s.status !== "completed" : window_ === "today" ? s.expectedAt.slice(0, 10) === today || (s.status !== "completed" && s.status !== "expected") : window_ === "week" ? s.status === "expected" && s.expectedAt <= weekEnd : true
  );
  const data = stage ? windowed.filter((s) => s.status === stage) : windowed;

  const stages = INBOUND_STAGES.map((k) => {
    const items = rows.filter((s) => s.status === k);
    const units = items.reduce((a, s) => a + s.units, 0);
    return { key: k, label: INBOUND_STATUS[k].label, count: items.length, hint: `${formatNumber(units)} units`, icon: STAGE_ICONS[k] };
  });

  const advance = (s: Row) => {
    const next = actions.advanceInbound(s.id);
    if (next) toast.success(`${s.id} → ${INBOUND_STATUS[next].label}`, { description: next === "completed" ? "Stock posted to inventory" : s.supplierName });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "id",
      header: "ASN",
      meta: { label: "ASN" },
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-xs font-medium">{row.original.id}</div>
          <div className="font-mono text-2xs text-muted-foreground">{row.original.poNumber}</div>
        </div>
      ),
    },
    {
      accessorKey: "supplierName",
      header: "Supplier",
      meta: { label: "Supplier" },
      filterFn: inArrayFilter,
      cell: ({ row }) => (
        <div className="max-w-[200px]">
          <div className="truncate">{row.original.supplierName}</div>
          <div className="truncate text-2xs text-muted-foreground">
            {row.original.carrier} · {row.original.pallets} plt
          </div>
        </div>
      ),
    },
    {
      accessorKey: "expectedAt",
      header: "Arrival",
      meta: { label: "Arrival" },
      cell: ({ row }) => {
        const late = row.original.status === "expected" && row.original.expectedAt < REFERENCE_NOW.toISOString();
        return (
          <div>
            <div className="tabular">{formatDateTime(row.original.arrivedAt ?? row.original.expectedAt)}</div>
            <div className={late ? "text-2xs font-medium text-danger" : "text-2xs text-muted-foreground"}>{late ? "Overdue · " : row.original.arrivedAt ? "Arrived · " : "ETA · "}{formatRelative(row.original.arrivedAt ?? row.original.expectedAt)}</div>
          </div>
        );
      },
    },
    { accessorKey: "dock", header: "Dock", meta: { label: "Dock" }, cell: ({ getValue }) => (getValue() ? <span className="font-mono text-xs">{getValue() as string}</span> : <span className="text-muted-foreground">—</span>) },
    { accessorKey: "units", header: "Expected", meta: { align: "right", label: "Qty expected" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
    {
      accessorKey: "received",
      header: "Received",
      meta: { label: "Qty received" },
      cell: ({ row }) => (
        <div className="w-28">
          <div className="mb-1 flex justify-between text-2xs tabular">
            <span className="font-medium">{formatNumber(row.original.received)}</span>
            <span className="text-muted-foreground">{Math.round((row.original.received / (row.original.units || 1)) * 100)}%</span>
          </div>
          <Progress value={(row.original.received / (row.original.units || 1)) * 100} size="xs" tone={row.original.status === "completed" ? "success" : "primary"} />
        </div>
      ),
    },
    {
      accessorKey: "variance",
      header: "Discrepancy",
      meta: { label: "Discrepancy" },
      cell: ({ row }) => {
        const r = row.original;
        if (!r.counted) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex gap-1">
            {r.variance === 0 && r.damaged === 0 && <Badge tone="success">Matched</Badge>}
            {r.variance < 0 && <Badge tone="danger">{r.variance} short</Badge>}
            {r.variance > 0 && <Badge tone="warning">+{r.variance} over</Badge>}
            {r.damaged > 0 && <Badge tone="warning">{r.damaged} dmg</Badge>}
          </div>
        );
      },
    },
    { accessorKey: "priority", header: "Priority", meta: { label: "Priority" }, filterFn: inArrayFilter, sortingFn: (a, b) => PRIORITY[a.original.priority].rank - PRIORITY[b.original.priority].rank, cell: ({ row }) => <Badge tone={PRIORITY[row.original.priority].tone}>{PRIORITY[row.original.priority].label}</Badge> },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={INBOUND_STATUS} value={row.original.status} /> },
    {
      id: "action",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        NEXT_ACTION[row.original.status] ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              advance(row.original);
            }}
          >
            {NEXT_ACTION[row.original.status]} <ArrowRight />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-2xs text-success">
            <PackageCheck className="size-3.5" /> Closed
          </span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inbound Operations"
        description={`Receiving, quality control and putaway at ${warehouse.name}`}
        actions={
          <Button
            onClick={() => {
              setPresetSku(undefined);
              setNewOpen(true);
            }}
          >
            <Plus /> New ASN
          </Button>
        }
      />

      <StageFlow stages={stages} active={stage} onSelect={setStage} />

      <DataTable
        key={warehouse.id}
        columns={columns}
        data={data}
        searchPlaceholder="Search ASN, PO, supplier, tracking…"
        searchText={(r) => `${r.id} ${r.poNumber} ${r.supplierName} ${r.trackingNumber} ${r.carrier} ${r.lines.map((l) => l.sku).join(" ")}`}
        facets={[
          { columnId: "supplierName", title: "Supplier", options: [...new Set(rows.map((r) => r.supplierName))].sort().map((s) => ({ label: s, value: s })) },
          { columnId: "priority", title: "Priority", options: Object.entries(PRIORITY).map(([value, m]) => ({ label: m.label, value })) },
        ]}
        toolbar={
          <Tabs value={window_} onValueChange={(v) => setWindow(v as typeof window_)}>
            <TabsList variant="segmented">
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="week">Next 7 days</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
        }
        initialSorting={[{ id: "expectedAt", desc: false }]}
        initialVisibility={{ dock: false }}
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        exportName={`inbound-${warehouse.id}`}
        exportRow={(r) => ({ asn: r.id, po: r.poNumber, supplier: r.supplierName, carrier: r.carrier, expected_at: r.expectedAt, dock: r.dock ?? "", qty_expected: r.units, qty_received: r.received, variance: r.variance, damaged: r.damaged, status: r.status })}
        emptyTitle={stage ? `No ${INBOUND_STATUS[stage as InboundStatus].label.toLowerCase()} shipments in this view` : undefined}
      />

      <InboundDrawer id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      <NewAsnDialog open={newOpen} onOpenChange={setNewOpen} presetSku={presetSku} />
    </div>
  );
}
