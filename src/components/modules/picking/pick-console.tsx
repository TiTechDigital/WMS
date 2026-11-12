"use client";

import * as React from "react";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, MapPin, Minus, Pause, Play, Plus, ScanBarcode, SkipForward, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { useWms } from "@/store/wms-store";
import { PRIORITY, TASK_STATUS } from "@/lib/status";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PickTask } from "@/types";

/**
 * RF-style pick execution panel. Designed with large touch targets and a single
 * scan input so it can be lifted into a handheld/mobile client unchanged.
 */
export function PickConsole({ task }: { task: PickTask }) {
  const { actions, employees, products, can } = useWms();
  const firstOpen = Math.max(0, task.lines.findIndex((l) => l.picked < l.quantity));
  const [idx, setIdx] = React.useState(firstOpen);
  const [locOk, setLocOk] = React.useState(false);
  const [qty, setQty] = React.useState(0);
  const [scan, setScan] = React.useState("");
  const [flash, setFlash] = React.useState<"ok" | "err" | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setIdx(Math.max(0, task.lines.findIndex((l) => l.picked < l.quantity)));
    setLocOk(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const line = task.lines[idx];
  React.useEffect(() => {
    if (line) setQty(line.quantity - line.picked);
    setLocOk(false);
  }, [idx, line?.sku]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = task.lines.reduce((s, l) => s + l.quantity, 0);
  const picked = task.lines.reduce((s, l) => s + l.picked, 0);
  const done = task.status === "completed";
  const pickers = employees.filter((e) => e.role === "Picker" && e.status !== "off_shift" && e.status !== "on_leave");
  const barcode = products.find((p) => p.sku === line?.sku)?.barcode;

  const pulse = (k: "ok" | "err") => {
    setFlash(k);
    setTimeout(() => setFlash(null), 450);
  };

  const [busy, setBusy] = React.useState(false);

  const confirm = async (amount: number) => {
    if (!line || busy) return;
    const newPicked = Math.min(line.quantity, line.picked + amount);
    setBusy(true);
    const res = await actions.confirmPick(task.id, idx, newPicked);
    setBusy(false);
    if (!res) {
      pulse("err");
      return;
    }
    const { completed } = res;
    pulse("ok");
    if (completed) {
      toast.success(`${task.id} complete`, { description: `${task.orderId} released to packing` });
      return;
    }
    if (newPicked >= line.quantity) {
      const next = task.lines.findIndex((l, i) => i !== idx && l.picked < l.quantity);
      if (next >= 0) setIdx(next);
    }
  };

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const v = scan.trim().toUpperCase();
    setScan("");
    if (!v || !line) return;
    if (v === line.locationCode.toUpperCase() || line.locationCode.toUpperCase().endsWith(v)) {
      setLocOk(true);
      pulse("ok");
      return;
    }
    if (v === line.sku.toUpperCase() || v === barcode) {
      if (!locOk) {
        pulse("err");
        toast.error("Scan the location first", { description: `Expected ${line.locationCode}` });
        return;
      }
      confirm(1);
      return;
    }
    pulse("err");
    toast.error("Unrecognised scan", { description: `“${v}” doesn't match location or SKU for this line` });
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-surface shadow-card transition-shadow", flash === "ok" && "ring-2 ring-success/50", flash === "err" && "ring-2 ring-danger/50")}>
      {/* Device header */}
      <div className="bg-sidebar px-5 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-semibold">{task.id}</span>
              <StatusBadge map={TASK_STATUS} value={task.status} />
            </div>
            <div className="mt-0.5 text-xs text-sidebar-muted">
              {task.orderId} · {task.customerName} · Zone {task.zone} · {task.type} pick
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={!can("orders.manage")}
                  title={can("orders.manage") ? "Assign picker" : "Assignment is done by supervisors"}
                  className="flex items-center gap-2 rounded-md border border-sidebar-border px-2 py-1 text-xs text-sidebar-foreground hover:bg-sidebar-accent disabled:cursor-default disabled:hover:bg-transparent"
                >
                  {task.assigneeName ? <Avatar name={task.assigneeName} size="xs" /> : <UserPlus className="size-3.5" />}
                  {task.assigneeName ?? "Assign"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                <DropdownMenuLabel>Assign picker</DropdownMenuLabel>
                {pickers.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={async () => {
                      if (await actions.assignTask(task.id, p.id)) toast.success(`${task.id} assigned to ${p.name}`);
                    }}
                  >
                    <Avatar name={p.name} size="xs" />
                    <span className="flex-1">{p.name}</span>
                    <span className="text-2xs text-muted-foreground">{p.zone}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {!done &&
              (task.status === "in_progress" ? (
                <Button size="sm" variant="ghost" className="text-white hover:bg-sidebar-accent hover:text-white" onClick={() => actions.setTaskStatus(task.id, "paused")}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button size="sm" onClick={() => actions.setTaskStatus(task.id, "in_progress")}>
                  <Play /> {task.status === "paused" ? "Resume" : "Start"}
                </Button>
              ))}
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(picked / total) * 100}%` }} />
          </div>
          <span className="text-xs tabular text-sidebar-foreground">
            {picked}/{total} units · {task.lines.filter((l) => l.picked >= l.quantity).length}/{task.lines.length} lines
          </span>
        </div>
      </div>

      {done ? (
        <div className="flex flex-col items-center px-6 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success-text">
            <Check className="size-6" />
          </span>
          <div className="mt-3 text-sm font-semibold">Task complete</div>
          <p className="mt-1 text-xs text-muted-foreground">All {total} units picked. {task.orderId} is waiting at the pack station.</p>
        </div>
      ) : (
        line && (
          <div className="space-y-4 p-5">
            {/* Current line */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Line {idx + 1} of {task.lines.length}
              </span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Previous line">
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" size="icon-sm" disabled={idx === task.lines.length - 1} onClick={() => setIdx(idx + 1)} aria-label="Next line">
                  <ChevronRight />
                </Button>
              </div>
            </div>
            <div className={cn("rounded-lg border-2 p-4 transition-colors", locOk ? "border-success/60 bg-success-soft/40" : "border-dashed border-primary/40 bg-primary-soft/40")}>
              <div className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-3" /> Go to location {locOk && <Badge tone="success" className="ml-1">Verified</Badge>}
              </div>
              <div className="mt-1 font-mono text-3xl font-semibold tracking-tight">{line.locationCode}</div>
            </div>
            <div className="grid grid-cols-[1fr_auto] items-end gap-4">
              <div className="min-w-0">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Pick item</div>
                <div className="mt-1 truncate text-base font-semibold">{line.productName}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {line.sku} · {barcode}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">Qty</div>
                <div className="text-3xl font-semibold tabular">
                  {line.picked}
                  <span className="text-lg text-muted-foreground">/{line.quantity}</span>
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{line.uom}</span>
                </div>
              </div>
            </div>

            <form onSubmit={onScan} className="relative">
              <ScanBarcode className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={scan}
                onChange={(e) => setScan(e.target.value)}
                placeholder={locOk ? "Scan item barcode or SKU…" : "Scan location label…"}
                className="h-12 w-full rounded-lg border-2 border-input bg-surface pl-11 pr-24 font-mono text-sm outline-none focus:border-primary"
                aria-label="Scan input"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-muted-foreground">Enter ↵</span>
            </form>
            <div className="flex flex-wrap gap-1.5 text-2xs text-muted-foreground">
              <span>Simulate scan:</span>
              <button type="button" className="rounded border px-2 py-1 font-mono hover:bg-accent" onClick={() => { setScan(line.locationCode); inputRef.current?.focus(); }}>
                {line.locationCode}
              </button>
              <button type="button" className="rounded border px-2 py-1 font-mono hover:bg-accent" onClick={() => { setScan(line.sku); inputRef.current?.focus(); }}>
                {line.sku}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border">
                <Button variant="ghost" size="xl" className="px-4" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
                  <Minus />
                </Button>
                <span className="w-12 text-center text-lg font-semibold tabular">{qty}</span>
                <Button variant="ghost" size="xl" className="px-4" onClick={() => setQty((q) => Math.min(line.quantity - line.picked, q + 1))} aria-label="Increase">
                  <Plus />
                </Button>
              </div>
              <Button size="xl" className="flex-1" disabled={line.picked >= line.quantity || busy} onClick={() => confirm(qty)}>
                <Check /> Confirm {qty}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  actions.log({ module: "Picking", action: "Short pick reported", entity: task.id, details: `${line.sku} at ${line.locationCode} — ${line.quantity - line.picked} missing`, severity: "warning", source: "RF Scanner" });
                  toast.warning("Short pick reported", { description: `Inventory control notified to recount ${line.locationCode}` });
                  const next = task.lines.findIndex((l, i) => i > idx && l.picked < l.quantity);
                  if (next >= 0) setIdx(next);
                }}
              >
                <AlertTriangle /> Short pick
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  const next = task.lines.findIndex((l, i) => i > idx && l.picked < l.quantity);
                  const wrap = task.lines.findIndex((l, i) => i !== idx && l.picked < l.quantity);
                  if (next >= 0) setIdx(next);
                  else if (wrap >= 0) setIdx(wrap);
                  else toast.info("No other open lines");
                }}
              >
                <SkipForward /> Skip line
              </Button>
            </div>
          </div>
        )
      )}

      {/* Line list */}
      <div className="border-t">
        {task.lines.map((l, i) => {
          const complete = l.picked >= l.quantity;
          return (
            <button key={l.sku + l.locationCode} onClick={() => setIdx(i)} className={cn("flex w-full items-center gap-3 border-b px-5 py-2.5 text-left last:border-0 hover:bg-subtle", i === idx && !done && "bg-primary-soft/50")}>
              <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold", complete ? "border-success bg-success text-white" : i === idx ? "border-primary text-primary" : "text-muted-foreground")}>
                {complete ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className="w-36 shrink-0 font-mono text-xs">{l.locationCode}</span>
              <span className="min-w-0 flex-1 truncate text-[13px]">{l.productName}</span>
              <span className="text-xs tabular text-muted-foreground">
                {l.picked}/{l.quantity}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t bg-subtle px-5 py-2 text-2xs text-muted-foreground">
        <span>
          <Badge tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label}</Badge> · due {formatRelative(task.dueAt)}
        </span>
        <span>{task.cart ?? "No cart"}</span>
      </div>
    </div>
  );
}
