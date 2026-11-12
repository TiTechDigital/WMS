"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Sidebar, SidebarNav, WarehouseSwitcher } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { LogoMark, PRODUCT_NAME } from "./logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useHotkey } from "@/hooks/use-hotkey";
import { useWms } from "@/store/wms-store";

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
  const { status, loadError, actions } = useWms();
  const pendingG = React.useRef(false);
  const pathname = usePathname();
  const mainRef = React.useRef<HTMLElement>(null);
  const firstRender = React.useRef(true);

  // Move focus to the page heading after client-side navigation so keyboard and
  // screen-reader users land at the start of the new page.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const h1 = mainRef.current?.querySelector("h1");
    if (h1) {
      h1.setAttribute("tabindex", "-1");
      h1.focus({ preventScroll: false });
    }
  }, [pathname]);

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
      <a
        href="#main"
        className="fixed left-3 top-3 z-[70] -translate-y-16 rounded-md bg-primary px-3 py-2 text-[13px] font-medium text-white focus:translate-y-0"
      >
        Skip to content
      </a>
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
          onSignOut={() => void actions.signOut()}
        />
        <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 px-4 py-5 outline-none lg:px-6 [&_h1:focus]:outline-none" aria-busy={status === "loading"}>
          {status === "ready" ? (
            children
          ) : status === "loading" ? (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-[13px] text-muted-foreground" role="status">
              <Loader2 className="size-5 animate-spin" aria-hidden />
              Loading warehouse data…
            </div>
          ) : (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="alert">
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-danger-soft text-danger-text">
                <AlertTriangle className="size-4" aria-hidden />
              </span>
              <h1 className="text-sm font-semibold">Couldn&apos;t load warehouse data</h1>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">{loadError}</p>
              <Button className="mt-4" onClick={() => void actions.reload()}>
                Try again
              </Button>
            </div>
          )}
        </main>
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

    </div>
  );
}
