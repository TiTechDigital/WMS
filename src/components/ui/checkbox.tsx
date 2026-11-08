"use client";
import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 16px visual box inside a 24×24 hit area (WCAG 2.5.8 target size) — dense tables keep
 * their look while the checkbox stays easy to hit.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "group/cb peer -m-1 inline-flex size-6 shrink-0 items-center justify-center rounded-[5px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    <span
      aria-hidden
      className="flex size-4 items-center justify-center rounded-[4px] border border-input bg-surface shadow-card transition-colors group-focus-visible/cb:ring-2 group-focus-visible/cb:ring-primary/40 group-data-[state=checked]/cb:border-primary group-data-[state=checked]/cb:bg-primary group-data-[state=checked]/cb:text-white group-data-[state=indeterminate]/cb:border-primary group-data-[state=indeterminate]/cb:bg-primary group-data-[state=indeterminate]/cb:text-white"
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} /> : <Check className="size-3" strokeWidth={3} />}
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
