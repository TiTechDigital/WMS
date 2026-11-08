"use client";
import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";


/**
 * Overlays opened programmatically (e.g. clicking a table row) have no Radix trigger to
 * return focus to. Remember what had focus when the overlay mounted and restore it on close.
 */
function useReturnFocus() {
  const prev = React.useRef<HTMLElement | null>(null);
  const capture = React.useCallback(() => {
    prev.current = document.activeElement as HTMLElement | null;
  }, []);
  const restore = React.useCallback((e: Event) => {
    const el = prev.current;
    if (el && el !== document.body && document.contains(el)) {
      e.preventDefault();
      el.focus();
    }
  }, []);
  return { capture, restore };
}

/** Side drawer built on Radix Dialog. */
export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & { width?: "md" | "lg" | "xl"; side?: "left" | "right" }
>(({ className, children, width = "lg", side = "right", onOpenAutoFocus, onCloseAutoFocus, ...props }, ref) => {
  const returnFocus = useReturnFocus();
  return (
  <SheetPrimitive.Portal>
    <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-gray-950/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <SheetPrimitive.Content
      ref={ref}
      onOpenAutoFocus={(e) => {
        returnFocus.capture();
        onOpenAutoFocus?.(e);
      }}
      onCloseAutoFocus={(e) => {
        onCloseAutoFocus?.(e);
        if (!e.defaultPrevented) returnFocus.restore(e);
      }}
      className={cn(
        "fixed inset-y-0 z-50 flex h-full w-full flex-col bg-surface shadow-pop duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
        side === "right"
          ? "right-0 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
          : "left-0 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        width === "md" && "sm:max-w-md",
        width === "lg" && "sm:max-w-xl",
        width === "xl" && "sm:max-w-3xl",
        className
      )}
      {...props}
    >
      {children}
      <SheetPrimitive.Close className="absolute right-3 top-3 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none">
        <X className="size-4" />
        <span className="sr-only">Close</span>
      </SheetPrimitive.Close>
    </SheetPrimitive.Content>
  </SheetPrimitive.Portal>
  );
});
SheetContent.displayName = "SheetContent";

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b px-5 py-4 pr-12", className)} {...props} />;
}
export function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex-1 overflow-y-auto px-5 py-4 scrollbar-thin", className)} {...props} />;
}
export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-end gap-2 border-t bg-subtle px-5 py-3", className)} {...props} />;
}
export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-sm font-semibold", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";
export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description ref={ref} className={cn("text-xs text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";
