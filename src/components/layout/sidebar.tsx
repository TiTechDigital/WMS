"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronsUpDown, PanelLeftClose, PanelLeftOpen, Warehouse as WarehouseIcon } from "lucide-react";
import { NAVIGATION, type NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { WAREHOUSES } from "@/lib/constants";
import { useWms } from "@/store/wms-store";
import { LogoMark, PRODUCT_NAME } from "./logo";
import { Hint } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import * as React from "react";

function useNavBadges() {
  const { orders, inbound, pickTasks, adjustments, inventory } = useWms();
  return React.useMemo(() => {
    const lowSkus = new Set(inventory.filter((r) => r.status === "low_stock" || r.status === "out_of_stock").map((r) => r.productId));
    return {
      pendingOrders: orders.filter((o) => ["new", "allocated", "picking", "packing", "ready_to_ship", "on_hold"].includes(o.status)).length,
      inboundToday: inbound.filter((s) => ["arrived", "receiving", "quality_check", "putaway"].includes(s.status)).length,
      activePicks: pickTasks.filter((t) => t.status === "in_progress" || t.status === "queued").length,
      pendingAdjustments: adjustments.filter((a) => a.status === "pending").length,
      lowStock: lowSkus.size,
    };
  }, [orders, inbound, pickTasks, adjustments, inventory]);
}

export function WarehouseSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { warehouse, setWarehouseId, all } = useWms();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/60 text-left transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            collapsed ? "justify-center p-1.5" : "px-2.5 py-2"
          )}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded bg-white/5 text-sidebar-foreground">
            <WarehouseIcon className="size-4" />
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-white">{warehouse.name}</span>
                <span className="block truncate font-mono text-2xs text-sidebar-muted">{warehouse.id} · {warehouse.city}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-sidebar-muted" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={collapsed ? "right" : "bottom"} className="w-64">
        <DropdownMenuLabel>Switch site</DropdownMenuLabel>
        {WAREHOUSES.map((w) => {
          const skus = new Set(all.inventory.filter((r) => r.warehouseId === w.id).map((r) => r.productId)).size;
          return (
            <DropdownMenuItem
              key={w.id}
              onSelect={() => {
                if (w.id !== warehouse.id) {
                  setWarehouseId(w.id);
                  toast.success(`Switched to ${w.name}`, { description: `${w.city} · ${skus} active SKUs` });
                }
              }}
            >
              <WarehouseIcon />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{w.name}</div>
                <div className="font-mono text-2xs text-muted-foreground">
                  {w.id} · {skus} SKUs
                </div>
              </div>
              {w.id === warehouse.id && <Check className="!text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=sites">
            <WarehouseIcon />
            Manage sites
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavLink({ item, collapsed, badge, onNavigate }: { item: NavItem; collapsed: boolean; badge?: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-[30px] items-center gap-2.5 rounded-md text-[13px] transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white"
      )}
    >
      {active && <span className="absolute -left-3 top-1.5 h-5 w-[3px] rounded-r bg-primary" />}
      <Icon className={cn("size-4 shrink-0", active ? "text-primary-foreground" : "text-sidebar-muted group-hover:text-sidebar-foreground")} strokeWidth={1.8} />
      {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
      {!collapsed && badge ? (
        <span className={cn("rounded px-1.5 font-mono text-2xs tabular", active ? "bg-primary text-white" : "bg-white/[0.07] text-sidebar-muted")}>{badge}</span>
      ) : null}
      {collapsed && badge ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" /> : null}
    </Link>
  );
  return collapsed ? (
    <Hint label={<span>{item.title}{badge ? ` · ${badge}` : ""}</span>} side="right">
      {link}
    </Hint>
  ) : (
    link
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const badges = useNavBadges();
  return (
    <nav className="flex flex-col gap-4">
      {NAVIGATION.map((section) => (
        <div key={section.title}>
          {!collapsed ? (
            <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">{section.title}</div>
          ) : (
            <div className="mx-auto mb-2 h-px w-5 bg-sidebar-border" />
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} badge={item.badgeKey ? badges[item.badgeKey] : undefined} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",
        collapsed ? "w-[60px]" : "w-[248px]"
      )}
    >
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
        <LogoMark />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-white">{PRODUCT_NAME}<span className="ml-1 font-normal text-sidebar-muted">WMS</span></div>
            <div className="text-2xs text-sidebar-muted">Northstar Logistics</div>
          </div>
        )}
      </div>
      <div className={cn("pt-3", collapsed ? "px-2" : "px-3")}>
        <WarehouseSwitcher collapsed={collapsed} />
      </div>
      <div className={cn("scrollbar-dark flex-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex justify-center")}>
        <button
          onClick={onToggle}
          className={cn(
            "flex h-8 items-center gap-2 rounded-md text-xs text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-white",
            collapsed ? "w-8 justify-center" : "w-full px-2.5"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && <span>Collapse</span>}
          {!collapsed && <span className="ml-auto font-mono text-[10px] opacity-70">[</span>}
        </button>
      </div>
    </aside>
  );
}
