"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CheckCheck, ClipboardCheck, PackageOpen, Server, Truck, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWms } from "@/store/wms-store";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";

const KIND: Record<AppNotification["kind"], { icon: React.ElementType; cls: string }> = {
  alert: { icon: AlertTriangle, cls: "bg-danger-soft text-danger" },
  inbound: { icon: PackageOpen, cls: "bg-cyan-50 text-cyan-700" },
  outbound: { icon: Truck, cls: "bg-primary-soft text-primary" },
  task: { icon: ClipboardCheck, cls: "bg-warning-soft text-[hsl(32_95%_38%)]" },
  system: { icon: Server, cls: "bg-muted text-muted-foreground" },
};

export function NotificationsPanel() {
  const { notifications, actions } = useWms();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "unread">("all");
  const unread = notifications.filter((n) => !n.read).length;
  const list = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white ring-2 ring-surface">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between px-4 pb-0 pt-3">
          <div className="text-sm font-semibold">Notifications</div>
          <Button variant="ghost" size="sm" onClick={actions.markAllNotificationsRead} disabled={unread === 0}>
            <CheckCheck /> Mark all read
          </Button>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "unread")} className="px-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread {unread > 0 && <span className="rounded bg-primary-soft px-1 text-2xs text-primary">{unread}</span>}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="scrollbar-thin max-h-[420px] overflow-y-auto">
          {list.length === 0 && <div className="px-4 py-10 text-center text-xs text-muted-foreground">You’re all caught up.</div>}
          {list.map((n) => {
            const k = KIND[n.kind];
            const Icon = k.icon;
            return (
              <div key={n.id} className={cn("group relative flex gap-3 border-b px-4 py-3 last:border-0 hover:bg-subtle", !n.read && "bg-primary-soft/40")}>
                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", k.cls)}>
                  <Icon className="size-3.5" />
                </span>
                <Link
                  href={n.href}
                  className="min-w-0 flex-1"
                  onClick={() => {
                    actions.markNotificationRead(n.id);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{n.title}</span>
                    {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                  <span className="mt-1 block text-2xs text-muted-foreground/80">{formatRelative(n.timestamp)}</span>
                </Link>
                <button
                  onClick={() => actions.dismissNotification(n.id)}
                  className="absolute right-2 top-2 hidden rounded p-1 text-muted-foreground hover:bg-accent group-hover:block"
                  aria-label="Dismiss"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
        <div className="border-t px-4 py-2 text-center">
          <Link href="/activity" onClick={() => setOpen(false)} className="text-xs font-medium text-primary hover:underline">
            View full activity log
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
