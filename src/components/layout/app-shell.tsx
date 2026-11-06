"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { Sidebar, SidebarNav, WarehouseSwitcher } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { LogoMark, PRODUCT_NAME } from "./logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Avatar } from "@/components/ui/avatar";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useHotkey } from "@/hooks/use-hotkey";
import { CURRENT_USER } from "@/store/wms-store";

const SHORTCUTS: [string, string[]][] = [
  ["Open search / scan", ["⌘", "K"]],
  ["Toggle sidebar", ["["]],
  ["Go to Dashboard", ["G", "D"]],
  ["Go to Inventory", ["G", "I"]],
  ["Go to Orders", ["G", "O"]],
  ["Go to Picking", ["G", "P"]],
  ["Show shortcuts", ["?"]],
];

const GO: Record<string, string> = { d: "/dashboard", i: "/inventory", o: "/orders", p: "/picking", r: "/inbound", l: "/locations" };

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useLocalStorage("wms.sidebar.collapsed", false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);
  const [shortcuts, setShortcuts] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  const pendingG = React.useRef(false);

  useHotkey("k", () => setSearchOpen((v) => !v), { meta: true });
  useHotkey("[", () => setCollapsed((v) => !v));
  useHotkey("?", () => setShortcuts(true));
  useHotkey("/", () => setSearchOpen(true));
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() === "g") {
        pendingG.current = true;
        setTimeout(() => (pendingG.current = false), 800);
        return;
      }
      if (pendingG.current && GO[e.key.toLowerCase()]) {
        pendingG.current = false;
        router.push(GO[e.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="!max-w-[280px] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground [&>button]:text-sidebar-muted">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
            <LogoMark />
            <span className="text-sm font-semibold text-white">{PRODUCT_NAME} WMS</span>
          </div>
          <div className="px-3 pt-3">
            <WarehouseSwitcher />
          </div>
          <div className="scrollbar-dark flex-1 overflow-y-auto px-3 py-4">
            <SidebarNav onNavigate={() => setMobileNav(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenShortcuts={() => setShortcuts(true)}
          onSignOut={() => setLocked(true)}
        />
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <Dialog open={shortcuts} onOpenChange={setShortcuts}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Work faster without leaving the keyboard.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-1">
            {SHORTCUTS.map(([label, keys]) => (
              <div key={label} className="flex items-center justify-between rounded px-1 py-1.5 text-[13px]">
                <span>{label}</span>
                <span className="flex gap-1">
                  {keys.map((k) => (
                    <Kbd key={k}>{k}</Kbd>
                  ))}
                </span>
              </div>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {locked && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border bg-surface p-6 text-center shadow-pop">
            <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-accent">
              <Lock className="size-4 text-muted-foreground" />
            </div>
            <h2 className="text-sm font-semibold">You have been signed out</h2>
            <p className="mt-1 text-xs text-muted-foreground">Your session was closed on this device. Any unsaved scanner input has been discarded.</p>
            <div className="mt-5 flex items-center gap-2.5 rounded-md border bg-subtle p-2.5 text-left">
              <Avatar name={CURRENT_USER.name} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium">{CURRENT_USER.name}</div>
                <div className="truncate text-xs text-muted-foreground">{CURRENT_USER.email}</div>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => setLocked(false)}>
              Sign back in
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
