# Halden WMS

A full-stack warehouse management system for distribution centers, 3PLs and manufacturing warehouses: inventory, locations, inbound receiving, outbound fulfillment, picking and packing, transfers, adjustments, reporting and user management.

It's one Next.js app containing both the web UI and the REST API, backed by **PostgreSQL**. **To run it, you only need to connect a database.**

---

## 1. Connect a database and run it

**Requirements:** Node.js 20+ and a PostgreSQL 14+ database. Any provider works: [Neon](https://neon.tech), [Supabase](https://supabase.com), Vercel Postgres (via the Vercel Marketplace), AWS RDS, or local Postgres.

```bash
npm install
cp .env.example .env          # then fill in the values (see below)
npm run db:deploy             # creates all tables
```

Then choose **one** of these:

```bash
# A) Demo data: 3 sites, ~100 SKUs, orders, shipments and 49 user accounts
npm run db:seed

# B) A clean production start: no demo data, just your first administrator and site
npm run db:create-admin -- --login admin --email you@company.com --name "Your Name" \
  --password "choose-a-long-password" --site WH-MXP --site-name "Milano Malpensa DC" \
  --city Milan --timezone Europe/Rome
```

Then start the app:

```bash
npm run dev                   # http://localhost:3000
```

### Environment variables

| Variable | What it is |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string used by the app. On hosted providers use the **pooled** URL. |
| `DIRECT_URL` | Direct (non-pooled) URL used only for migrations. If you have only one URL, use the same value. |
| `AUTH_SECRET` | Signs session cookies. At least 32 random characters: `openssl rand -base64 48`. |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | Only for `npm run db:seed` (demo accounts). |

### Demo accounts (after `db:seed`)

| Sign-in ID | Password | Role |
|---|---|---|
| `admin` | `SEED_ADMIN_PASSWORD` | Administrator (all sites, users, settings) |
| Any employee badge, e.g. `ATL-1040` | `SEED_USER_PASSWORD` | Based on job: manager, supervisor or operator |

Operators see only their home site. **Change these passwords** before showing the app to anyone.

---

## 2. Deploy to Vercel

1. Create a PostgreSQL database (e.g. Neon from Vercel → Storage → Marketplace).
2. In **Vercel → Project → Settings → Environment Variables**, add `DATABASE_URL`, `DIRECT_URL` and `AUTH_SECRET`.
3. Deploy. The `vercel-build` script runs `prisma migrate deploy` automatically, so tables are created and kept up to date on every deploy.
4. Create your first administrator **once**, from your computer, pointing at the production database:
   ```bash
   DATABASE_URL="…" DIRECT_URL="…" npm run db:create-admin -- --login admin --email you@company.com --name "Your Name" --password "…"
   ```
5. Sign in at `https://your-app.vercel.app/login`, then build your layout in **Locations → Add locations** and add people in **Settings → Users & roles**.

> Never run `db:seed` against production: it deletes all data. The script refuses to run when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true`.

---

## 3. What's included

### Backend
- **REST API** in `src/app/api/**`, more than 30 endpoints. Every input is validated with zod, every action checks permissions, every change runs in a database transaction and writes an audit log entry.
- **Business logic** in `src/server/services`:
  - **Receiving:** advances ASN → arrival → receiving → QC → putaway → completion. Completing a receipt **posts stock to inventory**.
  - **Orders:** allocation creates pick tasks; picking, packing and shipping update order lines.
  - **Picking:** scan-to-confirm per line; completing the last line moves the order to packing.
  - **Transfers:** completing one **moves stock** between locations.
  - **Adjustments:** approval workflow; approved adjustments **change stock**.
  - **Stock status:** recomputed automatically against min/max per site.
  - **Document numbers** (SO, ASN, PK, TR, ADJ) come from atomic counters.
- **Authentication:**
  - employee ID or email plus password, hashed with bcrypt,
  - 12-hour signed session cookie (HTTP-only),
  - login throttling,
  - middleware that protects every page and API route.
- **Roles:** admin, manager, supervisor, operator (`src/lib/permissions.ts`). The server enforces them; the UI hides what a role can't do. Operators are limited to their home site.

### Frontend
Seventeen modules: Dashboard, Analytics, Inventory, Products, Locations (floor plan plus a layout builder), Inbound, Outbound, Picking & Packing (scanner-style console and pack station), Transfers, Adjustments, Orders, Suppliers, Customers, Employees, Reports (CSV export and schedules), Activity log and Settings (organization, sites, users, notifications, integrations, profile and password).

The UI targets WCAG 2.2 AA. It has keyboard support, screen-reader labels, 24px+ targets and reduced-motion support, and works down to phone width.

### Project layout
```
prisma/
  schema.prisma          database schema (PostgreSQL)
  migrations/            SQL migrations
  seed.ts                demo data
  create-admin.ts        first administrator for a clean install
src/
  app/(app)/…            pages (signed-in area)
  app/login/             sign-in page
  app/api/…              REST API route handlers
  middleware.ts          authentication gate
  server/                server-only code: db client, auth, validation, services, serializers
  store/wms-store.tsx    client store: loads data from the API, calls API actions
  components/            UI (design system, layout, modules)
  lib/                   shared helpers (permissions, formatting, status maps)
  types/                 domain types shared by client and server
```

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:migrate` | Create a new migration after editing `schema.prisma` (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Reset and load demo data (**deletes everything**) |
| `npm run db:create-admin` | Create or reset an administrator |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run typecheck` | TypeScript check |

### Health check
`GET /api/health` returns `{ ok: true, database: "connected" }` when the app can reach the database.

---

## 4. Production checklist (not yet built)

The core system works end to end. These need external services or decisions before real-world rollout:

| Area | What's needed |
|---|---|
| **Scheduled reports by email** | Schedules are saved. Delivery needs an email provider (Resend, Postmark, SES) and a cron job (Vercel Cron) that runs due schedules. |
| **Daily metrics** | Charts on Dashboard and Analytics read the `DailyMetric` table, which only the demo seed fills. Add a nightly job that aggregates the day's receipts, shipments and orders into it. |
| **Integrations** | The Settings switches record intent only. ERP, Shopify, EDI and carrier (UPS/FedEx) connectors need their own adapters and credentials. |
| **Product images** | Stored as data URLs in the database (up to 2 MB). Move to object storage (Vercel Blob, S3, R2) at scale. |
| **Login throttling** | Per server instance. Use a shared store (Upstash Redis) for multi-instance deployments. |
| **Large datasets** | The app loads a site's data on sign-in. That's fine for tens of thousands of records; beyond that, switch big tables to server-side pagination (the API layer is ready for it). |
| **Notifications** | Demo notifications are seeded. Generating them from live events (stock-outs, late orders) is a small job that inserts into the `Notification` table. |
| **Backups and monitoring** | Turn on your database provider's automatic backups and add error monitoring (e.g. Sentry). |
