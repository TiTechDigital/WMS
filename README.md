# Halden WMS

Frontend foundation for a next-generation warehouse management system: an enterprise SaaS UI for distribution centers, 3PLs and manufacturing warehouses.

This phase covers the visual identity, navigation, all main modules, interactive workflows and realistic seeded data. There is no backend yet. Every screen runs on a client-side store built so an API can replace it module by module.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000  → redirects to /dashboard
npm run build      # production build (all routes prerender statically)
npm run typecheck
```

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui-style components on Radix primitives · Lucide icons · Recharts · TanStack Table v8 · Sonner toasts · Geist fonts.

## Modules

| Section | Route | Highlights |
|---|---|---|
| Overview | `/dashboard` | 6 KPIs, inventory movement, in vs out, category distribution, fulfilment, capacity by zone, pending inbound, orders awaiting pick, low stock with one-click replenishment, activity feed, workforce on shift |
| | `/analytics` | Turnover, accuracy, fulfilment rate, pick time, utilization and volume, with date range, interval and previous-period comparison |
| Operations | `/inventory` | Searchable, sortable, faceted table; status chips; product drawer (locations, network stock, details, history); bulk cycle counts; CSV export |
| | `/products` | Table and grid views; add/edit form with validation, image upload, SKU and EAN-13 generation; duplicate and discontinue |
| | `/locations` | Interactive floor plan (docks, staging, pick racks, pallet racks, bulk lanes, cold storage) shaded by occupancy, with SKU locate; location list; block or activate |
| | `/inbound` | Expected → Arrived → Receiving → QC → Putaway → Completed pipeline; line-level receiving with discrepancies; new ASN; completed receipts post stock to inventory |
| | `/outbound` | New → Allocated → Picking → Packing → Ready → Shipped pipeline; wave release; carrier cut-offs with manifest close |
| | `/picking` | RF-style pick console (scan location, then item), short pick and skip; pack station with item verification and carton selection |
| | `/transfers`, `/adjustments` | Create, dispatch and complete transfers (stock actually moves); adjustments with approval workflow |
| Management | `/orders`, `/suppliers`, `/customers`, `/employees` | Order management with drawer and new-order entry; partner and workforce directories with detail drawers and add dialogs |
| System | `/reports`, `/activity`, `/settings` | Reports that generate real CSVs from live data, plus scheduling; full audit log; organization, sites, roles, notifications, integrations and profile settings |

Global features: site switcher (Atlanta, Dallas, Reno; all data is scoped per site), command palette (`⌘K`, also accepts scanner input), notifications panel, user menu, keyboard shortcuts (`?`, `[`, `g d`, `g i`, …), collapsible sidebar, and a responsive layout down to phone width.

## Architecture

```
src/
  app/(app)/<module>/page.tsx   thin server pages (metadata) that render a module view
  components/
    ui/                         design-system primitives (button, dialog, sheet, tabs, select…)
    layout/                     app shell: sidebar, topbar, command palette, notifications
    data-table/                 generic TanStack table: search, facets, sort, paging, selection, export
    charts/                     chart kit (validated palette, tooltip, legend), trend and sparkline charts
    shared/                     page header, KPI card, stage flow, date range picker, SKU picker…
    modules/<module>/           feature views, drawers and dialogs
  data/                         deterministic seeded mock data (products, locations, orders…)
  store/wms-store.tsx           client store and domain actions (receive, pick, approve, transfer…)
  types/                        domain model
  lib/                          formatting, status maps, navigation, metrics, CSV
  hooks/                        local storage, hotkeys, URL query flags
```

### Integrating a backend later

- **All mutations go through store actions** (`useWms().actions.*`). Pages never edit data directly. To connect an API, keep the action signatures and implement them with fetch, server actions or React Query mutations.
- **Reads are already scoped**: `useWms()` exposes site-filtered collections. These can become query hooks per module, one module at a time.
- **The seed data is deterministic** (seeded PRNG plus a fixed reference time in `lib/constants.ts`), so server and client renders match. When live data arrives, replace `REFERENCE_NOW` with the real clock.
- **The domain types in `src/types`** map directly to future database tables and API DTOs.
- **Barcode scanning**: the pick console and command palette already handle keyboard-wedge scanner input (scan then Enter), so hardware scanners work without extra integration.
