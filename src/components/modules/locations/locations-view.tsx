"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, ClipboardCheck, Map as MapIcon, Rows3, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useWms } from "@/store/wms-store";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, inArrayFilter } from "@/components/data-table/data-table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, utilizationTone } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/shared/status-badge";
import { WarehouseMap, MapLegend } from "./warehouse-map";
import { LocationDrawer } from "./location-drawer";
import { useInitialParam } from "@/hooks/use-query-flag";
import { LOCATION_STATUS, LOCATION_TYPE_LABEL } from "@/lib/status";
import { formatDate, formatNumber } from "@/lib/format";
import type { Location } from "@/types";

type Row = Location & { pct: number; products: string };

export function LocationsView() {
  const { locations, zones, inventory, warehouse, actions } = useWms();
  const q = useInitialParam("q");
  const [tab, setTab] = React.useState(q ? "list" : "map");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [mapQuery, setMapQuery] = React.useState("");
  const selected = locations.find((l) => l.id === selectedId) ?? null;

  const skusByLoc = React.useMemo(() => {
    const m = new Map<string, string[]>();
    inventory.forEach((r) => m.set(r.locationCode, [...(m.get(r.locationCode) ?? []), r.sku]));
    return m;
  }, [inventory]);

  const highlight = React.useMemo(() => {
    const t = mapQuery.trim().toLowerCase();
    if (t.length < 2) return null;
    const set = new Set<string>();
    inventory.forEach((r) => {
      if (r.sku.toLowerCase().includes(t) || r.productName.toLowerCase().includes(t)) set.add(r.locationCode);
    });
    locations.forEach((l) => l.code.toLowerCase().includes(t) && set.add(l.code));
    return set;
  }, [mapQuery, inventory, locations]);

  const rows = React.useMemo<Row[]>(() => locations.map((l) => ({ ...l, pct: l.capacity ? (l.occupied / l.capacity) * 100 : 0, products: (skusByLoc.get(l.code) ?? []).join(", ") })), [locations, skusByLoc]);

  const storage = locations.filter((l) => l.type !== "dock" && l.type !== "staging");
  const cap = storage.reduce((s, l) => s + l.capacity, 0);
  const occ = storage.reduce((s, l) => s + l.occupied, 0);
  const stats = [
    ["Storage locations", formatNumber(storage.length), `${zones.length} zones`],
    ["Utilization", `${((occ / (cap || 1)) * 100).toFixed(1)}%`, `${formatNumber(occ)} / ${formatNumber(cap)} units`],
    ["Empty & available", formatNumber(storage.filter((l) => l.occupied === 0 && l.status === "active").length), "ready for putaway"],
    ["Blocked / maintenance", formatNumber(locations.filter((l) => l.status === "blocked" || l.status === "maintenance").length), "unavailable"],
    ["Near capacity", formatNumber(storage.filter((l) => l.capacity && l.occupied / l.capacity >= 0.9).length), "≥ 90% full"],
  ];

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: "code", header: "Location", meta: { label: "Location" }, cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span> },
    { accessorKey: "type", header: "Type", meta: { label: "Type" }, filterFn: inArrayFilter, cell: ({ getValue }) => LOCATION_TYPE_LABEL[getValue() as string] },
    { accessorKey: "zone", header: "Zone", meta: { label: "Zone" }, filterFn: inArrayFilter, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "aisle", header: "Aisle", meta: { label: "Aisle" }, cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "rack", header: "Rack", meta: { label: "Rack" }, cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "shelf", header: "Shelf", meta: { label: "Shelf" }, cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "bin", header: "Bin", meta: { label: "Bin" }, cell: ({ getValue }) => <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span> },
    { accessorKey: "capacity", header: "Capacity", meta: { align: "right", label: "Capacity" }, cell: ({ getValue }) => formatNumber(getValue() as number) },
    {
      accessorKey: "pct",
      header: "Occupancy",
      meta: { label: "Occupancy" },
      cell: ({ row }) => (
        <div className="flex w-36 items-center gap-2">
          <Progress value={row.original.pct} tone={utilizationTone(row.original.pct)} className="flex-1" />
          <span className="w-9 text-right text-xs tabular text-muted-foreground">{row.original.pct.toFixed(0)}%</span>
        </div>
      ),
    },
    { accessorKey: "products", header: "Assigned products", meta: { label: "Assigned products" }, cell: ({ getValue }) => <span className="block max-w-[200px] truncate font-mono text-2xs text-muted-foreground">{(getValue() as string) || "—"}</span> },
    { accessorKey: "status", header: "Status", meta: { label: "Status" }, filterFn: inArrayFilter, cell: ({ row }) => <StatusBadge map={LOCATION_STATUS} value={row.original.status} /> },
    { accessorKey: "lastCountedAt", header: "Last counted", meta: { label: "Last counted" }, cell: ({ getValue }) => <span className="text-muted-foreground">{formatDate(getValue() as string)}</span> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Locations & Storage"
        description={`Warehouse → Zone → Aisle → Rack → Shelf → Bin · ${warehouse.name}`}
        actions={
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList variant="segmented">
              <TabsTrigger value="map">
                <MapIcon /> Layout
              </TabsTrigger>
              <TabsTrigger value="list">
                <Rows3 /> Location list
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-card md:grid-cols-5">
        {stats.map(([k, v, h]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <div className="text-2xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular">{v}</div>
            <div className="text-2xs text-muted-foreground">{h}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="map" className="mt-0">
          <div className="space-y-4">
            <Card>
              <CardHeader
                title={`${warehouse.name} — floor plan`}
                description="Each cell is one storage position. Click to inspect; hover for details."
                actions={
                  <div className="relative w-56">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} placeholder="Locate SKU or location…" className="h-7 pl-8 pr-7 text-xs" />
                    {mapQuery && (
                      <button onClick={() => setMapQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear">
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                }
              />
              <CardContent className="space-y-4">
                <WarehouseMap locations={locations} zones={zones} onSelect={(l) => setSelectedId(l.id)} highlight={highlight} />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <MapLegend />
                  {highlight && <span className="text-2xs font-medium text-foreground">{highlight.size} matching location{highlight.size === 1 ? "" : "s"}</span>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Zones" description="Capacity by storage area" />
              <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {zones.map((z) => {
                  const ls = locations.filter((l) => l.zone === z.code);
                  const c = ls.reduce((s, l) => s + l.capacity, 0);
                  const o = ls.reduce((s, l) => s + l.occupied, 0);
                  const pct = c ? (o / c) * 100 : 0;
                  return (
                    <div key={z.id} className="bg-surface px-4 py-3">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span className="flex size-5 items-center justify-center rounded border bg-subtle font-mono text-[10px] font-semibold">{z.code}</span>
                          <span className="font-medium">{z.name}</span>
                        </span>
                        <span className="tabular text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} tone={utilizationTone(pct)} size="xs" />
                      <div className="mt-1 text-2xs text-muted-foreground">
                        {ls.length} {LOCATION_TYPE_LABEL[z.type].toLowerCase()}s · {ls.filter((l) => l.occupied === 0).length} empty
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="list" className="mt-0">
          <DataTable
            key={warehouse.id}
            columns={columns}
            data={rows}
            searchPlaceholder="Search location code or SKU…"
            searchText={(r) => `${r.code} ${r.products}`}
            initialSearch={q ?? ""}
            initialVisibility={{ aisle: false, rack: false, shelf: false, bin: false }}
            facets={[
              { columnId: "zone", title: "Zone", options: zones.map((z) => ({ label: `${z.code} · ${z.name}`, value: z.code })) },
              { columnId: "type", title: "Type", options: Object.entries(LOCATION_TYPE_LABEL).map(([value, label]) => ({ label, value })) },
              { columnId: "status", title: "Status", options: Object.entries(LOCATION_STATUS).map(([value, m]) => ({ label: m.label, value })) },
            ]}
            onRowClick={(r) => setSelectedId(r.id)}
            getRowId={(r) => r.id}
            selectable
            bulkActions={(sel, clear) => (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    actions.log({ module: "Inventory", action: "Cycle count scheduled", entity: `${sel.length} locations`, details: sel.slice(0, 3).map((l) => l.code).join(", "), severity: "info" });
                    toast.success(`${sel.length} locations queued for counting`);
                    clear();
                  }}
                >
                  <ClipboardCheck /> Count
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    sel.forEach((l) => actions.setLocationStatus(l.id, "blocked"));
                    toast.success(`${sel.length} locations blocked`);
                    clear();
                  }}
                >
                  <Ban /> Block
                </Button>
              </>
            )}
            exportName={`locations-${warehouse.id}`}
            exportRow={(r) => ({ code: r.code, type: r.type, zone: r.zone, aisle: r.aisle, rack: r.rack, shelf: r.shelf, bin: r.bin, capacity: r.capacity, occupied: r.occupied, occupancy_pct: r.pct.toFixed(1), products: r.products, status: r.status })}
          />
        </TabsContent>
      </Tabs>

      <LocationDrawer location={selected} onOpenChange={(o) => !o && setSelectedId(null)} />
    </div>
  );
}
