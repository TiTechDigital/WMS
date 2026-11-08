"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ConfirmOptions {
  title: string;
  /** What will happen, stated specifically ("24 orders move to Allocated and pick tasks are created"). */
  description: React.ReactNode;
  /** Optional list of affected records, shown as a preview. */
  items?: string[];
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
}

/**
 * Confirmation step for bulk or irreversible operations. The confirm button repeats the
 * action name so the user knows exactly what they're agreeing to.
 */
export function useConfirm() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const confirm = React.useCallback((o: ConfirmOptions) => setOpts(o), []);
  const preview = opts?.items ?? [];

  const dialog = (
    <Dialog open={!!opts} onOpenChange={(o) => !o && setOpts(null)}>
      <DialogContent size="sm" role="alertdialog">
        {opts && (
          <>
            <DialogHeader className="flex-row items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
                  opts.tone === "danger" ? "bg-danger-soft text-danger-text" : "bg-primary-soft text-primary"
                )}
                aria-hidden
              >
                <AlertTriangle className="size-4" />
              </span>
              <div className="space-y-1">
                <DialogTitle>{opts.title}</DialogTitle>
                <DialogDescription className="text-[13px] leading-5">{opts.description}</DialogDescription>
              </div>
            </DialogHeader>
            {preview.length > 0 && (
              <DialogBody className="py-3">
                <ul className="scrollbar-thin max-h-40 space-y-1 overflow-y-auto font-mono text-xs" aria-label="Affected records">
                  {preview.slice(0, 12).map((i) => (
                    <li key={i} className="rounded bg-subtle px-2 py-1">
                      {i}
                    </li>
                  ))}
                  {preview.length > 12 && <li className="px-2 py-1 font-sans text-muted-foreground">and {preview.length - 12} more</li>}
                </ul>
              </DialogBody>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpts(null)}>
                Cancel
              </Button>
              <Button
                variant={opts.tone === "danger" ? "danger" : "default"}
                onClick={() => {
                  const fn = opts.onConfirm;
                  setOpts(null);
                  fn();
                }}
                autoFocus
              >
                {opts.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
