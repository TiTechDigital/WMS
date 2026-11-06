"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Keyboard,
  LogOut,
  Menu,
  PackageOpen,
  PackagePlus,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  UserRound,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Avatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NAVIGATION } from "@/lib/navigation";
import { CURRENT_USER, useWms } from "@/store/wms-store";
import { NotificationsPanel } from "./notifications";
import { formatTime } from "@/lib/format";
import { REFERENCE_NOW } from "@/lib/constants";

function useCrumbs() {
  const pathname = usePathname();
  for (const s of NAVIGATION) {
    const item = s.items.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
    if (item) return { section: s.title, title: item.title };
  }
  return { section: "Overview", title: "Dashboard" };
}

export function Topbar({
  onOpenSearch,
  onOpenMobileNav,
  onOpenShortcuts,
  onSignOut,
}: {
  onOpenSearch: () => void;
  onOpenMobileNav: () => void;
  onOpenShortcuts: () => void;
  onSignOut: () => void;
}) {
  const crumbs = useCrumbs();
  const router = useRouter();
  const { warehouse } = useWms();

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-surface/85 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu />
      </Button>
      <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex" aria-label="Breadcrumb">
        <span className="text-muted-foreground">{warehouse.name}</span>
        <ChevronRight className="size-3.5 text-muted-foreground/60" />
        <span className="text-muted-foreground">{crumbs.section}</span>
        <ChevronRight className="size-3.5 text-muted-foreground/60" />
        <span className="truncate font-medium">{crumbs.title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={onOpenSearch}
          className="flex h-8 w-9 items-center gap-2 rounded-md border border-input bg-subtle px-2.5 text-[13px] text-muted-foreground shadow-card transition-colors hover:bg-accent sm:w-64"
        >
          <Search className="size-4 shrink-0" />
          <span className="hidden flex-1 truncate text-left sm:block">Search or scan…</span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="default" className="hidden sm:inline-flex">
              <Plus /> Create
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Quick create</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => router.push("/orders?new=1")}>
              <ClipboardList /> Sales order
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/inbound?new=1")}>
              <PackageOpen /> Inbound ASN
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/transfers?new=1")}>
              <ArrowLeftRight /> Stock transfer
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => router.push("/adjustments?new=1")}>
              <SlidersHorizontal /> Stock adjustment
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => router.push("/products?new=1")}>
              <PackagePlus /> Product / SKU
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

        <div className="hidden items-center gap-1.5 rounded-md px-2 text-2xs text-muted-foreground xl:flex" title="Real-time sync with RF devices">
          <Wifi className="size-3.5 text-success" />
          <span>Synced {formatTime(REFERENCE_NOW.toISOString())} UTC</span>
        </div>

        <Button variant="ghost" size="icon" onClick={onOpenShortcuts} aria-label="Keyboard shortcuts" className="hidden sm:inline-flex">
          <HelpCircle />
        </Button>
        <NotificationsPanel />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex items-center gap-2 rounded-md p-1 pr-1.5 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
              <Avatar name={CURRENT_USER.name} size="sm" />
              <span className="hidden text-left leading-tight xl:block">
                <span className="block text-xs font-medium">{CURRENT_USER.name}</span>
                <span className="block text-2xs text-muted-foreground">{CURRENT_USER.role}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <Avatar name={CURRENT_USER.name} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{CURRENT_USER.name}</div>
                <div className="truncate text-xs text-muted-foreground">{CURRENT_USER.email}</div>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings?tab=profile">
                <UserRound /> My profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpenShortcuts}>
              <Keyboard /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={onSignOut}>
              <LogOut /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
