"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Plus, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { DateRangePicker, inRange, presetRange, type DateRange } from "@/components/shared/date-range-picker";
import { OrderDrawer } from "./order-drawer";
import { NewOrderDialog } from "./new-order-dialog";
import { ORDER_NEXT_ACTION, OPEN_STATUSES, orderTotals } from "./order-shared";
import { useQueryFlag } from "@/hooks/use-query-flag";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { ORDER_STATUS, PRIORITY } from "@/lib/status";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Order } from "@/types";

type Row = Order & { qty: number; value: number; items: number };

export function OrdersView() {
  const { orders, warehouse, actions } = useWms();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [newOpen, setNewOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "open" | "shipped" | "exceptions">("all");
  const [range, setRange] = React.useState<DateRange>(presetRange("14d"));
  const { confirm, dialog } = useConfirm();
  useQueryFlag("id", setOpenId);
  useQueryFlag("new", () => setNewOpen(true));

  const rows = React.useMemo<Row[]>(() => orders.map((o) => ({ ...o, ...orderTotals(o), items: o.lines.length })), [orders]);
  const inDates = rows.filter((o) => inRange(o.createdAt, range));
  const counts = {
    all: inDates.length,
    open: inDates.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    shipped: inDates.filter((o) => o.status === "shipped" || o.status === "delivered").length,
    exceptions: inDates.filter((o) => o.status === "on_hold" || o.status === "cancelled").length,
  };
  const data = inDates.filter((o) =>
    tab === "open" ? OPEN_STATUSES.includes(o.status) : tab === "shipped" ? o.status === "shipped" || o.status === "delivered" : tab === "exceptions" ? o.status === "on_hold" || o.status === "cancelled" : true
  );
  const value = data.reduce((s, o) => s + o.value, 0);

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "id", header: "Order ID", meta: { label: "Order ID" }, cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span> },
    {
      accessorKey: "customerName",
      header: "Customer",
      meta: { label: "Customer" },
      cell: ({ row }) => (
        <div className="max-w-[220px]">
          <div className="truncate">{row.original.customerName}</div>
          <div className="truncate text-2xs text-muted-foreground">
            {row.original.shippingAddress.city}, {row.original.shippingAddress.state}
          </div>
        </div>
      ),
    },
    { accessorKey: "channel", header: "Channel", meta: { label: "Channel" }, filterFn: inArrayFilter, cell: ({ getValue }) => <Badge>{getValue() as string}</Badge> },
    { accessorKey: "createdAt", header: "Date", meta: { label: "Date" }, cell: ({ getValue }) => <span className="tabular text-muted-foreground">{formatDateTime(getValue() as string)}</span> },
    { accessorKey: "items", header: "Items", meta: { align: "right", label: "Items" } },
    { accessorKey: "qty", header: "Total qty", meta: { align: "right", label: "Total qty" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
    { accessorKey: "value", header: "Value", meta: { align: "right", label: "Value" }, cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: "priority", header: "Priority", meta: { label: "Priority" }, filterFn: inArrayFilter, sortingFn: (a, b) => PRIORITY[a.original.priority].rank - PRIORITY[b.original.priority].rank, cell: ({ row }) => <Badge tone={PRIORITY[row.original.priority].tone}>{PRIORITY[row.original.priority].label}</Badge> },
    { accessorKey: "status", header: "Fulfillment", meta: { label: "Fulfillment status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={ORDER_STATUS} value={row.original.status} /> },
    {
      id: "action",
      header: "",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) =>
        ORDER_NEXT_ACTION[row.original.status] ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              const next = actions.advanceOrder(row.original.id);
              if (next) toast.success(`${row.original.id} → ${ORDER_STATUS[next].label}`);
            }}
          >
            {ORDER_NEXT_ACTION[row.original.status]} <ArrowRight />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        description={`${counts.open} open · ${formatCurrency(value)} in current view`}
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} />
            <Button onClick={() => setNewOpen(true)}>
              <Plus /> New order
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          {(
            [
              ["all", "All orders"],
              ["open", "Open"],
              ["shipped", "Shipped"],
              ["exceptions", "Exceptions"],
            ] as const
          ).map(([k, l]) => (
            <TabsTrigger key={k} value={k}>
              {l} <span className="rounded bg-accent px-1.5 text-2xs tabular text-muted-foreground">{counts[k]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        key={warehouse.id + tab}
        columns={columns}
        data={data}
        searchPlaceholder="Search order, customer, SKU, tracking…"
        searchText={(r) => `${r.id} ${r.customerName} ${r.trackingNumber ?? ""} ${r.lines.map((l) => l.sku).join(" ")}`}
        facets={[
          { columnId: "status", title: "Status", options: Object.entries(ORDER_STATUS).map(([value, m]) => ({ label: m.label, value })) },
          { columnId: "priority", title: "Priority", options: Object.entries(PRIORITY).map(([value, m]) => ({ label: m.label, value })) },
          { columnId: "channel", title: "Channel", options: ["EDI", "B2B Portal", "Shopify", "Marketplace", "Manual"].map((c) => ({ label: c, value: c })) },
        ]}
        initialSorting={[{ id: "createdAt", desc: true }]}
        onRowClick={(r) => setOpenId(r.id)}
        getRowId={(r) => r.id}
        selectable
        bulkActions={(sel, clear) => (
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const ok = sel.filter((o) => ORDER_NEXT_ACTION[o.status] && o.status !== "on_hold");
                const skipped = sel.length - ok.length;
                if (!ok.length) return toast.info("None of the selected orders can be advanced", { description: "They are closed or on hold." });
                confirm({
                  title: `Advance ${ok.length} order${ok.length === 1 ? "" : "s"} to the next stage?`,
                  description: `Each order moves one step through fulfillment (e.g. New → Allocated).${skipped ? ` ${skipped} selected order${skipped === 1 ? " is" : "s are"} closed or on hold and will be skipped.` : ""}`,
                  items: ok.map((o) => `${o.id} · ${ORDER_STATUS[o.status].label} → next`),
                  confirmLabel: `Advance ${ok.length}`,
                  onConfirm: () => {
                    ok.forEach((o) => actions.advanceOrder(o.id));
                    toast.success(`${ok.length} orders advanced`, { description: skipped ? `${skipped} skipped (closed or on hold)` : undefined });
                    clear();
                  },
                });
              }}
            >
              <ArrowRight /> Advance
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const ok = sel.filter((o) => OPEN_STATUSES.includes(o.status) && o.status !== "on_hold");
                if (!ok.length) return toast.info("None of the selected orders can be put on hold");
                confirm({
                  title: `Put ${ok.length} order${ok.length === 1 ? "" : "s"} on hold?`,
                  description: "Held orders stop at their current stage and won't be released to picking until the hold is removed.",
                  items: ok.map((o) => `${o.id} · ${o.customerName}`),
                  confirmLabel: `Hold ${ok.length}`,
                  onConfirm: () => {
                    ok.forEach((o) => actions.setOrderStatus(o.id, "on_hold"));
                    toast.warning(`${ok.length} orders placed on hold`);
                    clear();
                  },
                });
              }}
            >
              <PauseCircle /> Hold
            </Button>
          </>
        )}
        exportName={`orders-${warehouse.id}`}
        exportRow={(r) => ({ order: r.id, customer: r.customerName, channel: r.channel, date: r.createdAt, items: r.items, quantity: r.qty, value: r.value.toFixed(2), priority: r.priority, status: r.status, carrier: r.carrier, tracking: r.trackingNumber ?? "" })}
      />

      <OrderDrawer id={openId} onOpenChange={(o) => !o && setOpenId(null)} />
      <NewOrderDialog open={newOpen} onOpenChange={setNewOpen} />
      {dialog}
    </div>
  );
}
