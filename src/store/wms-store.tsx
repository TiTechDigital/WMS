"use client";

/**
 * Client data store backed by the WMS API.
 *
 * - On load it fetches everything the signed-in user may see (`GET /api/data`).
 * - Every action calls the API (which validates, enforces permissions, runs the business
 *   logic in a transaction and writes the audit log), then re-fetches only the collections
 *   that action can change. The server is the single source of truth.
 * - Actions resolve to the API result, or `null` if the request failed (the error is shown
 *   to the user as a toast), so call sites can do `if (await actions.x()) toast.success(…)`.
 */
import * as React from "react";
import { toast } from "sonner";
import { can as canRole, ROLE_LABEL, type Permission, type Role } from "@/lib/permissions";
import type {
  ActivityEvent,
  AppNotification,
  Customer,
  DailyMetric,
  Employee,
  InboundShipment,
  InventoryRecord,
  Location,
  LocationStatus,
  Order,
  OrderStatus,
  PickTask,
  Priority,
  Product,
  StockAdjustment,
  StockTransfer,
  Supplier,
  Zone,
} from "@/types";

/* ───────────────────────────── Types ───────────────────────────── */

export interface SessionUser {
  id: string;
  login: string;
  name: string;
  email: string;
  role: Role;
  warehouseId: string | null;
  employeeId: string | null;
  profile: { phone?: string; language?: string; title?: string };
}

export interface Warehouse {
  id: string;
  name: string;
  city: string;
  timezone: string;
  stockLevelFactor: number;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  frequency: string;
  time: string;
  recipients: string;
  enabled: boolean;
}

export interface UserAccount {
  id: string;
  login: string;
  email: string;
  name: string;
  role: Role;
  warehouseId: string | null;
  employeeId: string | null;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

interface Data {
  warehouses: Warehouse[];
  zones: Zone[];
  locations: Location[];
  inventory: InventoryRecord[];
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  employees: Employee[];
  inbound: InboundShipment[];
  orders: Order[];
  pickTasks: PickTask[];
  transfers: StockTransfer[];
  adjustments: StockAdjustment[];
  activity: ActivityEvent[];
  notifications: AppNotification[];
  metrics: Record<string, DailyMetric[]>;
  settings: Record<string, Record<string, unknown>>;
  reportSchedules: ReportSchedule[];
  users: UserAccount[];
}
type Collection = keyof Data;

const EMPTY: Data = {
  warehouses: [], zones: [], locations: [], inventory: [], products: [], suppliers: [], customers: [], employees: [],
  inbound: [], orders: [], pickTasks: [], transfers: [], adjustments: [], activity: [], notifications: [], metrics: {},
  settings: {}, reportSchedules: [], users: [],
};

/* ───────────────────────────── API client ───────────────────────────── */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 401 && typeof window !== "undefined" && !url.startsWith("/api/auth/")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new ApiError(401, "Your session has expired. Sign in again.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.message ?? `Request failed (${res.status}).`);
  return json as T;
}

/* ───────────────────────────── Store ───────────────────────────── */

type Ctx = ReturnType<typeof useStoreValue>;
const StoreContext = React.createContext<Ctx | null>(null);
const SITE_KEY = "wms.site";

let idCounter = 1;
/** Client-only id for ephemeral UI records (e.g. report runs). Server records get server ids. */
const uid = (p: string) => `${p}_${Date.now().toString(36)}${(idCounter++).toString(36)}`;
const nowIso = () => new Date().toISOString();

function useStoreValue() {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [data, setData] = React.useState<Data>(EMPTY);
  const [warehouseId, setWarehouseIdState] = React.useState<string>("");
  const [syncedAt, setSyncedAt] = React.useState<string | null>(null);

  const apply = React.useCallback((res: { user: SessionUser; data: Partial<Data> }) => {
    setUser(res.user);
    setData((prev) => ({ ...prev, ...res.data }));
    setSyncedAt(nowIso());
  }, []);

  const load = React.useCallback(async () => {
    setStatus("loading");
    setLoadError(null);
    try {
      const res = await api<{ user: SessionUser; data: Data }>("GET", "/api/data");
      apply(res);
      const sites = res.data.warehouses;
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(SITE_KEY);
      } catch {
        /* storage unavailable */
      }
      const preferred = [saved, res.user.warehouseId].find((id) => id && sites.some((w) => w.id === id));
      setWarehouseIdState(preferred ?? sites[0]?.id ?? "");
      setStatus("ready");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load data.");
      setStatus("error");
    }
  }, [apply]);

  React.useEffect(() => {
    void load();
  }, [load]);

  /** Re-fetch specific collections (activity is always refreshed after a change). */
  const refresh = React.useCallback(
    async (collections: Collection[]) => {
      const list = [...new Set<Collection>([...collections, "activity"])];
      try {
        apply(await api("GET", `/api/data?collections=${list.join(",")}`));
      } catch (e) {
        toast.error("Couldn't refresh data", { description: e instanceof Error ? e.message : undefined });
      }
    },
    [apply]
  );

  /** Run an API mutation, refresh affected data, surface errors. Resolves to the result or null. */
  const mutate = React.useCallback(
    async <T,>(call: () => Promise<T>, collections: Collection[]): Promise<T | null> => {
      try {
        const result = await call();
        await refresh(collections);
        return result;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
        // Data may have changed underneath us (e.g. a conflict) — resync what we were editing.
        void refresh(collections);
        return null;
      }
    },
    [refresh]
  );

  const setWarehouseId = React.useCallback((id: string) => {
    setWarehouseIdState(id);
    try {
      window.localStorage.setItem(SITE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const warehouse = data.warehouses.find((w) => w.id === warehouseId) ?? data.warehouses[0] ?? { id: "", name: "—", city: "", timezone: "UTC", stockLevelFactor: 1 };
  const can = React.useCallback((p: Permission) => canRole(user?.role, p), [user?.role]);

  /* ───────── Actions ───────── */
  const STOCK: Collection[] = ["inventory", "locations"];

  const actions = React.useMemo(() => {
    const m = mutate;
    return {
      reload: load,
      /** UI-originated audit events (labels printed, counts scheduled, reports run…). */
      log: (e: { module: ActivityEvent["module"]; action: string; entity: string; details: string; severity?: ActivityEvent["severity"]; source?: "Web" | "RF Scanner" }) =>
        m(() => api("POST", "/api/activity", { warehouseId, ...e }), []),

      // Catalog & partners
      upsertProduct: (p: Product, isNew: boolean) => {
        const body = {
          sku: p.sku, name: p.name, barcode: p.barcode, category: p.category, brand: p.brand, description: p.description, uom: p.uom,
          unitsPerCase: p.unitsPerCase, weightKg: p.weightKg, dimensions: p.dimensions, minStock: p.minStock, maxStock: p.maxStock,
          reorderQty: p.reorderQty, supplierId: p.supplierId, unitCost: p.unitCost, unitPrice: p.unitPrice, storage: p.storage, status: p.status, imageUrl: p.imageUrl ?? null,
        };
        return m(() => api<{ id: string }>(isNew ? "POST" : "PUT", isNew ? "/api/products" : `/api/products/${p.id}`, body), ["products", "inventory"]);
      },
      upsertSupplier: (s: Supplier, isNew: boolean) => {
        const { id, code, ...body } = s;
        return m(() => api<{ id: string }>(isNew ? "POST" : "PUT", isNew ? "/api/suppliers" : `/api/suppliers/${id}`, body), ["suppliers"]);
      },
      upsertCustomer: (c: Customer, isNew: boolean) => {
        const { id, code, ...body } = c;
        return m(() => api<{ id: string }>(isNew ? "POST" : "PUT", isNew ? "/api/customers" : `/api/customers/${id}`, body), ["customers"]);
      },

      // Locations & sites
      setLocationStatus: (ids: string | string[], status: LocationStatus) =>
        m(() => api<{ count: number }>("PATCH", "/api/locations", { ids: Array.isArray(ids) ? ids : [ids], status }), ["locations"]),
      createLocations: (input: { zone: { code: string; name: string; type: string; temperature?: string }; aisles: [number, number]; racks: [number, number]; levels: string[]; binsPerLevel: number; capacity: number }) =>
        m(() => api<{ created: number; skipped: number }>("POST", "/api/locations", { warehouseId, ...input }), ["locations", "zones"]),
      deleteLocations: (ids: string[]) => m(() => api<{ deleted: number; blocked: string[] }>("DELETE", "/api/locations", { ids }), ["locations", "inventory"]),
      createWarehouse: (input: { id: string; name: string; city: string; timezone: string }) => m(() => api("POST", "/api/warehouses", input), ["warehouses"]),

      // Inbound
      advanceInbound: async (id: string) => (await m(() => api<{ status: InboundShipment["status"] }>("POST", `/api/inbound/${id}/advance`), ["inbound", ...STOCK]))?.status ?? null,
      updateInboundLine: (id: string, sku: string, received: number, damaged: number) =>
        m(() => api("PATCH", `/api/inbound/${id}/lines`, { sku, received, damaged }), ["inbound"]),
      createInbound: (input: { supplierId: string; poNumber: string; carrier: string; expectedAt: string; priority: Priority; lines: { productId: string; expected: number }[] }) =>
        m(() => api<{ id: string }>("POST", "/api/inbound", { warehouseId, ...input }), ["inbound"]),

      // Orders & outbound
      advanceOrder: async (id: string) => (await m(() => api<{ status: OrderStatus }>("POST", `/api/orders/${id}/advance`), ["orders", "pickTasks"]))?.status ?? null,
      advanceOrders: (ids: string[]) => m(() => api<{ results: { id: string; status?: string; error?: string }[] }>("POST", "/api/orders/bulk", { action: "advance", ids }), ["orders", "pickTasks"]),
      setOrderStatus: (ids: string | string[], status: "on_hold" | "cancelled" | "shipped" | "new") =>
        m(() => api<{ count: number }>("POST", "/api/orders/bulk", { action: "status", ids: Array.isArray(ids) ? ids : [ids], status }), ["orders", "pickTasks"]),
      packOrder: (id: string) => m(() => api("POST", `/api/orders/${id}/pack`), ["orders", "pickTasks"]),
      setOrderPriority: (id: string, priority: Priority) => m(() => api("PATCH", `/api/orders/${id}`, { priority }), ["orders", "pickTasks"]),
      createOrder: (input: { customerId: string; priority: Priority; carrier: string; service: string; notes?: string; lines: { productId: string; quantity: number }[] }) =>
        m(() => api<{ id: string }>("POST", "/api/orders", { warehouseId, ...input }), ["orders"]),
      releaseWave: () => m(() => api<{ count: number }>("POST", "/api/orders/release-wave", { warehouseId }), ["orders", "pickTasks"]),

      // Picking
      assignTask: (taskId: string, employeeId: string) => m(() => api("POST", `/api/pick-tasks/${taskId}/assign`, { employeeId }), ["pickTasks"]),
      setTaskStatus: (taskId: string, status: "in_progress" | "paused") => m(() => api("PATCH", `/api/pick-tasks/${taskId}`, { status }), ["pickTasks", "orders"]),
      confirmPick: async (taskId: string, lineIndex: number, picked: number) =>
        (await m(() => api<{ completed: boolean }>("POST", `/api/pick-tasks/${taskId}/pick`, { lineIndex, picked }), ["pickTasks", "orders"])) ?? null,

      // Transfers & adjustments
      createTransfer: (input: { type: StockTransfer["type"]; fromLocation: string; toLocation: string; productId: string; quantity: number; reason: string }) =>
        m(() => api<{ id: string }>("POST", "/api/transfers", { warehouseId, ...input }), ["transfers"]),
      setTransferStatus: (id: string, status: "requested" | "in_transit" | "completed" | "cancelled") =>
        m(() => api("PATCH", `/api/transfers/${id}`, { status }), ["transfers", ...STOCK]),
      createAdjustment: (input: { productId: string; locationCode: string; counted: number; reason: StockAdjustment["reason"]; note?: string; postNow?: boolean }) =>
        m(() => api<{ id: string; status: string }>("POST", "/api/adjustments", { warehouseId, ...input }), ["adjustments", ...STOCK]),
      reviewAdjustment: (ids: string | string[], decision: "approved" | "rejected") =>
        m(() => api<{ count: number }>("POST", "/api/adjustments/review", { ids: Array.isArray(ids) ? ids : [ids], decision }), ["adjustments", ...STOCK]),

      // People
      setEmployeeStatus: (id: string, status: Employee["status"]) => m(() => api("PATCH", `/api/employees/${id}`, { status }), ["employees"]),
      createEmployee: (input: { name: string; role: Employee["role"]; shift: Employee["shift"]; zone: string }) =>
        m(() => api<{ id: string; badge: string }>("POST", "/api/employees", { warehouseId, ...input }), ["employees"]),
      createUser: (input: { login: string; email: string; name: string; role: Role; warehouseId: string | null; password: string }) =>
        m(() => api<{ id: string }>("POST", "/api/users", input), ["users"]),
      updateUser: (id: string, input: Partial<{ name: string; email: string; role: Role; warehouseId: string | null; active: boolean; password: string }>) =>
        m(() => api("PATCH", `/api/users/${id}`, input), ["users"]),
      updateProfile: async (input: Partial<{ name: string; email: string; phone: string; language: string; currentPassword: string; newPassword: string }>) => {
        const r = await m(() => api("PATCH", "/api/me", input), []);
        if (r) setUser((u) => (u ? { ...u, name: input.name ?? u.name, email: input.email ?? u.email, profile: { ...u.profile, ...(input.phone !== undefined ? { phone: input.phone } : {}), ...(input.language !== undefined ? { language: input.language } : {}) } } : u));
        return r;
      },

      // Notifications, settings, report schedules
      // Optimistic: the UI updates instantly; the refresh after the call reconciles with the server.
      markNotificationRead: (id: string) => {
        setData((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
        return m(() => api("PATCH", "/api/notifications", { ids: [id] }), ["notifications"]);
      },
      markAllNotificationsRead: () => {
        setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
        return m(() => api("PATCH", "/api/notifications", { ids: "all" }), ["notifications"]);
      },
      dismissNotification: (id: string) => {
        setData((d) => ({ ...d, notifications: d.notifications.filter((n) => n.id !== id) }));
        return m(() => api("DELETE", `/api/notifications/${id}`), ["notifications"]);
      },
      saveSetting: (key: "organization" | "integrations" | "notificationPrefs", value: Record<string, unknown>) =>
        m(() => api("PUT", `/api/settings/${key}`, { value }), ["settings"]),
      createSchedule: (input: { reportId: string; frequency: string; time: string; recipients: string }) => m(() => api<ReportSchedule>("POST", "/api/report-schedules", input), ["reportSchedules"]),
      updateSchedule: (id: string, enabled: boolean) => m(() => api("PATCH", `/api/report-schedules/${id}`, { enabled }), ["reportSchedules"]),
      deleteSchedule: (id: string) => m(() => api("DELETE", `/api/report-schedules/${id}`), ["reportSchedules"]),

      signOut: async () => {
        try {
          await api("POST", "/api/auth/logout");
        } finally {
          window.location.href = "/login";
        }
      },
    };
  }, [mutate, load, warehouseId]);

  /* ───────── Site-scoped views ───────── */
  const scoped = React.useMemo(() => {
    const w = <T extends { warehouseId: string }>(arr: T[]) => arr.filter((x) => x.warehouseId === warehouseId);
    return {
      inventory: w(data.inventory),
      locations: w(data.locations),
      inbound: w(data.inbound),
      orders: w(data.orders),
      pickTasks: w(data.pickTasks),
      transfers: w(data.transfers),
      adjustments: w(data.adjustments),
      activity: w(data.activity),
      employees: w(data.employees),
      zones: w(data.zones),
      metrics: data.metrics[warehouseId] ?? [],
    };
  }, [data, warehouseId]);

  return {
    status,
    loadError,
    syncedAt,
    user,
    roleLabel: user ? ROLE_LABEL[user.role] : "",
    can,
    warehouse,
    warehouseId,
    warehouses: data.warehouses,
    setWarehouseId,
    all: data,
    products: data.products,
    suppliers: data.suppliers,
    customers: data.customers,
    notifications: data.notifications,
    settings: data.settings,
    reportSchedules: data.reportSchedules,
    users: data.users,
    ...scoped,
    actions,
  };
}

export function WmsStoreProvider({ children }: { children: React.ReactNode }) {
  const value = useStoreValue();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useWms() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useWms must be used inside <WmsStoreProvider>");
  return ctx;
}

export { uid, nowIso };
