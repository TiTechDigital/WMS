"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { FieldContext } from "@/components/ui/field-context";
import { cn } from "@/lib/utils";

export function Field({ label, htmlFor, error, hint, required, className, children }: { label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  const auto = React.useId();
  const id = htmlFor ?? `f${auto.replace(/:/g, "")}`;
  const msgId = `${id}-msg`;
  const message = error ?? hint;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} id={`${id}-label`}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger-text" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only"> (required)</span>}
      </Label>
      <FieldContext.Provider value={{ id, describedBy: message ? msgId : undefined, invalid: !!error }}>{children}</FieldContext.Provider>
      {message && (
        <p id={msgId} className={cn("text-2xs", error ? "text-danger-text" : "text-muted-foreground")} role={error ? "alert" : undefined}>
          {message}
        </p>
      )}
    </div>
  );
}
