"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Boxes, CheckCircle2, ClipboardList, Layers, PackageCheck, ScanLine, Send, Truck } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Hint } from "@/components/ui/tooltip";
import { StageFlow } from "@/components/shared/stage-flow";
import { StatusBadge } from "@/components/shared/status-badge";
import { OrderDrawer } from "../orders/order-drawer";
import { ORDER_NEXT_ACTION, orderTotals } from "../orders/order-shared";
import { useInitialParam } from "@/hooks/use-query-flag";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ORDER_STATUS, PRIORITY } from "@/lib/status";
import { formatDateTime, formatRelative } from "@/lib/format";
import { REFERENCE_NOW } from "@/lib/constants";
import { ORDER_STAGES, type Order, type OrderStatus } from "@/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ElementType> = { new: ClipboardList, allocated: Layers, picking: ScanLine, packing: Boxes, ready_to_ship: PackageCheck, shipped: Truck };
const CUTOFFS: Record<string, string> = { UPS: "16:30", FedEx: "17:00", USPS: "15:00", "XPO Logistics": "14:00", "Old Dominion": "15:30" };

type Row = Order & { qty: number; picked: number; packed: number };

export function OutboundView() {
  const { orders, warehouse, actions } = useWms();
  const priorityParam = useInitialParam("priority");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [stage, setStage] = React.useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const dayAgo = new Date(REFERENCE_NOW.getTime() - 86400000).toISOString();
  const active = React.useMemo<Row[]>(
    () =>
      orders
        .filter((o) => (ORDER_STAGES as readonly string[]).includes(o.status) && (o.status !== "shipped" || (o.shippedAt ?? "") >= dayAgo))
        .map((o) => ({ ...o, ...orderTotals(o) })),
    [orders, dayAgo]
  );
  const data = stage ? active.filter((o) => o.status === stage) : active;
  const stages = ORDER_STAGES.map((k) => ({
    key: k,
    label: ORDER_STATUS[k].label,
    count: active.filter((o) => o.status === k).length,
    hint: k === "shipped" ? "last 24h" : `${active.filter((o) => o.status === k && o.priority === "urgent").length} urgent`,
    icon: ICONS[k],
  }));

  const ready = active.filter((o) => o.status === "ready_to_ship");
  const carriers = Object.keys(CUTOFFS).map((c) => ({ carrier: c, cutoff: CUTOFFS[c], orders: ready.filter((o) => o.carrier === c) }));
  const late = active.filter((o) => o.status !== "shipped" && o.requestedShipAt < REFERENCE_NOW.toISOString()).length;

  const releaseWave = () => {
    const n = active.filter((o) => o.status === "new");
    if (!n.length) return toast.info("No new orders to release");
    confirm({
      title: `Release ${n.length} order${n.length === 1 ? "" : "s"} to picking?`,
      description: `Each order is allocated and a pick task is created in the Picking console. ${n.filter((o) => o.priority === "urgent").length} urgent.`,
      items: n.map((o) => `${o.id} · ${o.customerName}`),
      confirmLabel: `Release ${n.length} orders`,
      onConfirm: () => doReleaseWave(n),
    });
  };
  const doReleaseWave = (n: Row[]) => {
    n.forEach((o) => actions.advanceOrder(o.id));
    actions.log({ module: "Picking", action: "Wave released", entity: `W-${REFERENCE_NOW.toISOString().slice(5, 10).replace("-", "")}-${String(n.length).padStart(2, "0")}`, details: `${n.length} orders allocated to pick tasks`, severity: "info" });
    toast.success(`Wave released · ${n.length} orders allocated`, { description: "Pick tasks created in the Picking console" });
  };

  const closeManifest = (carrier: string, list: Row[]) =>
    confirm({
      title: `Close ${carrier} manifest?`,
      description: `${list.length} shipment${list.length === 1 ? "" : "s"} will be marked as shipped and handed over to ${carrier}. This can't be undone from the WMS.`,
      items: list.map((o) => `${o.id} · ${o.trackingNumber ?? "label pending"}`),
      confirmLabel: `Ship ${list.length} with ${carrier}`,
      onConfirm: () => doCloseManifest(carrier, list),
    });
  const doCloseManifest = (carrier: string, list: Row[]) => {
    list.forEach((o) => actions.setOrderStatus(o.id, "shipped"));
    toast.success(`${carrier} manifest closed`, { description: `${list.length} shipment${list.length === 1 ? "" : "s"} handed over` });
  };

  const columns: ColumnDef<Row, unknown>[] = [
    {
      accessorKey: "id",
      header: "Order",
      meta: { label: "Order" },
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-xs font-medium">{row.original.id}</div>
          <div className="text-2xs text-muted-foreground">{row.original.channel}</div>
        </div>
      ),
    },
    {
      accessorKey: "customerName",
      header: "Customer / ship to",
      meta: { label: "Customer" },
      cell: ({ row }) => (
        <div className="max-w-[190px]">
          <div className="truncate">{row.original.customerName}</div>
          <div className="truncate text-2xs text-muted-foreground">
            {row.original.shippingAddress.city}, {row.original.shippingAddress.state} {row.original.shippingAddress.postalCode}
          </div>
        </div>
      ),
    },
    { accessorKey: "priority", header: "Priority", meta: { label: "Priority" }, filterFn: inArrayFilter, sortingFn: (a, b) => PRIORITY[a.original.priority].rank - PRIORITY[b.original.priority].rank, cell: ({ row }) => <Badge tone={PRIORITY[row.original.priority].tone}>{PRIORITY[row.original.priority].label}</Badge> },
    {
      id: "products",
      header: "Requested products",
      meta: { label: "Requested products" },
      accessorFn: (r) => r.lines.length,
      cell: ({ row }) => {
        const l = row.original.lines;
        return (
          <Hint
            label={
              <div className="space-y-0.5">
                {l.map((x) => (
                  <div key={x.sku + x.locationCode} className="flex justify-between gap-4">
                    <span className="font-mono">{x.sku}</span>
                    <span>× {x.quantity}</span>
                  </div>
                ))}
              </div>
            }
          >
            <div className="max-w-[200px] cursor-default">
              <div className="truncate text-xs">{l[0]?.productName}</div>
              <div className="text-2xs text-muted-foreground">
                {l.length > 1 ? `+${l.length - 1} more · ` : ""}
                {row.original.qty} units
              </div>
            </div>
          </Hint>
        );
      },
    },
    {
      id: "picking",
      header: "Picking",
      meta: { label: "Picking status" },
      accessorFn: (r) => r.picked / (r.qty || 1),
      cell: ({ row }) => <MiniProgress done={row.original.picked} total={row.original.qty} active={row.original.status === "picking"} />,
    },
    {
      id: "packing",
      header: "Packing",
      meta: { label: "Packing status" },
      accessorFn: (r) => r.packed / (r.qty || 1),
      cell: ({ row }) => <MiniProgress done={row.original.packed} total={row.original.qty} active={row.original.status === "packing"} />,
    },
    {
      id: "shipping",
      header: "Shipping",
      meta: { label: "Shipping status" },
      accessorFn: (r) => r.carrier,
      cell: ({ row }) => (
        <div>
          <div className="text-xs">
            {row.original.carrier} <span className="text-muted-foreground">{row.original.service}</span>
          </div>
          <div className="font-mono text-2xs text-muted-foreground">{row.original.trackingNumber ?? (row.original.status === "shipped" ? "" : "Awaiting label")}</div>
        </div>
      ),
    },
    {
      accessorKey: "requestedShipAt",
      header: "Ship by",
      meta: { label: "Ship by" },
      cell: ({ row }) => {
        const isLate = row.original.status !== "shipped" && row.original.requestedShipAt < REFERENCE_NOW.toISOString();
        return (
          <div>
            <div className="tabular text-xs">{formatDateTime(row.original.requestedShipAt)}</div>
            <div className={cn("text-2xs", isLate ? "font-medium text-danger-text" : "text-muted-foreground")}>{isLate ? `Late · ${formatRelative(row.original.requestedShipAt)}` : formatRelative(row.original.requestedShipAt)}</div>
          </div>
        );
      },
    },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={ORDER_STATUS} value={row.original.status} /> },
    {
      id: "action",
      header: "",
      enableHiding: false,
      enableSorting: false,
      cell: ({ row }) =>
        ORDER_NEXT_ACTION[row.original.status] ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={(e) => {
              e.stopPropagation();
              const next = actions.advanceOrder(row.original.id);
              if (next) toast.success(`${row.original.id} → ${ORDER_STATUS[next as OrderStatus].label}`);
            }}
          >
            {ORDER_NEXT_ACTION[row.original.status]} <ArrowRight />
          </Button>
        ) : (
          <CheckCircle2 className="size-4 text-success-text" />
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Outbound Operations"
        description={`Fulfilment pipeline for ${warehouse.name} · ${late} shipment${late === 1 ? "" : "s"} past promise date`}
        actions={
          <Button onClick={releaseWave}>
            <Send /> Release wave ({active.filter((o) => o.status === "new").length})
          </Button>
        }
      />

      <StageFlow stages={stages} active={stage} onSelect={setStage} />

      <div className="grid gap-4 2xl:grid-cols-[1fr_320px]">
        <DataTable
          key={warehouse.id}
          columns={columns}
          data={data}
          searchPlaceholder="Search order, customer, SKU, tracking…"
          searchText={(r) => `${r.id} ${r.customerName} ${r.shippingAddress.city} ${r.trackingNumber ?? ""} ${r.lines.map((l) => l.sku).join(" ")}`}
          facets={[
            { columnId: "priority", title: "Priority", options: Object.entries(PRIORITY).map(([value, m]) => ({ label: m.label, value })) },
            { columnId: "status", title: "Status", options: ORDER_STAGES.map((k) => ({ label: ORDER_STATUS[k].label, value: k })) },
          ]}
          initialFilters={priorityParam ? [{ id: "priority", value: [priorityParam] }] : []}
          initialSorting={[{ id: "priority", desc: true }]}
          onRowClick={(r) => setOpenId(r.id)}
          getRowId={(r) => r.id}
          exportName={`outbound-${warehouse.id}`}
          exportRow={(r) => ({ order: r.id, customer: r.customerName, city: r.shippingAddress.city, priority: r.priority, units: r.qty, picked: r.picked, packed: r.packed, carrier: `${r.carrier} ${r.service}`, tracking: r.trackingNumber ?? "", ship_by: r.requestedShipAt, status: r.status })}
        />
        <Card className="h-fit">
          <CardHeader title="Carrier cut-offs" description={`Today · ${ready.length} parcels ready to ship`} />
          <div className="divide-y">
            {carriers.map((c) => (
              <div key={c.carrier} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-8 items-center justify-center rounded-md border bg-subtle">
                  <Truck className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium">{c.carrier}</div>
                  <div className="text-2xs text-muted-foreground">
                    Pickup {c.cutoff} · {c.orders.length} ready
                  </div>
                </div>
                <Button size="sm" variant="secondary" disabled={!c.orders.length} onClick={() => closeManifest(c.carrier, c.orders)}>
                  Close manifest
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <OrderDrawer id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      {dialog}
    </div>
  );
}

function MiniProgress({ done, total, active }: { done: number; total: number; active?: boolean }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="w-20">
      <div className="mb-1 flex justify-between text-2xs tabular">
        <span className={cn(pct === 100 ? "text-success-text" : active ? "font-medium text-primary" : "text-muted-foreground")}>{pct === 100 ? "Done" : active ? "Active" : pct ? "Partial" : "Pending"}</span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} size="xs" tone={pct === 100 ? "success" : "primary"} />
    </div>
  );
}
