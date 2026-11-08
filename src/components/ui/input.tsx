import * as React from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "./field-context";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...rest }, ref) => {
    const props = useFieldControlProps(rest);
    return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-8 w-full rounded-md border border-input bg-surface px-2.5 text-[13px] shadow-card transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-xs file:font-medium",
        className
      )}
      {...props}
    />
    );
  }
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => {
    const props = useFieldControlProps(rest);
    return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[72px] w-full rounded-md border border-input bg-surface px-2.5 py-1.5 text-[13px] shadow-card placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15",
        className
      )}
      {...props}
    />
    );
  }
);
Textarea.displayName = "Textarea";
