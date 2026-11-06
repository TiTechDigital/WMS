import {
  LayoutDashboard,
  LineChart,
  Boxes,
  PackageSearch,
  Warehouse,
  PackageOpen,
  Truck,
  ScanLine,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardList,
  Factory,
  Building2,
  Users,
  FileBarChart,
  History,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badgeKey?: "pendingOrders" | "inboundToday" | "activePicks" | "pendingAdjustments" | "lowStock";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, description: "Live operational state of the site" },
      { title: "Analytics", href: "/analytics", icon: LineChart, description: "KPIs, trends and performance" },
    ],
  },
  {
    title: "Warehouse Operations",
    items: [
      { title: "Inventory", href: "/inventory", icon: Boxes, description: "Stock on hand by SKU and location", badgeKey: "lowStock" },
      { title: "Products / SKU Catalog", href: "/products", icon: PackageSearch, description: "Master data for every item" },
      { title: "Locations & Storage", href: "/locations", icon: Warehouse, description: "Zones, racks, bins and occupancy" },
      { title: "Inbound Operations", href: "/inbound", icon: PackageOpen, description: "ASNs, receiving and putaway", badgeKey: "inboundToday" },
      { title: "Outbound Operations", href: "/outbound", icon: Truck, description: "Fulfilment pipeline and shipping" },
      { title: "Picking & Packing", href: "/picking", icon: ScanLine, description: "Operator task execution", badgeKey: "activePicks" },
      { title: "Stock Transfers", href: "/transfers", icon: ArrowLeftRight, description: "Moves, replenishment and rebalancing" },
      { title: "Stock Adjustments", href: "/adjustments", icon: SlidersHorizontal, description: "Counts, write-offs and corrections", badgeKey: "pendingAdjustments" },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Orders", href: "/orders", icon: ClipboardList, description: "Centralised sales order management", badgeKey: "pendingOrders" },
      { title: "Suppliers", href: "/suppliers", icon: Factory, description: "Vendors and inbound performance" },
      { title: "Customers", href: "/customers", icon: Building2, description: "Accounts, SLAs and ship-to data" },
      { title: "Employees & Operators", href: "/employees", icon: Users, description: "Workforce, shifts and productivity" },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Reports", href: "/reports", icon: FileBarChart, description: "Scheduled and on-demand reports" },
      { title: "Activity Logs", href: "/activity", icon: History, description: "Audit trail of every transaction" },
      { title: "Settings", href: "/settings", icon: Settings, description: "Site, users and integrations" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAVIGATION.flatMap((s) => s.items);
