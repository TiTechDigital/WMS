import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-[5px] border px-1.5 py-px text-2xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground/80",
        primary: "border-primary/20 bg-primary-soft text-primary-text",
        success: "border-success/25 bg-success-soft text-success-text",
        warning: "border-warning/40 bg-warning-soft text-warning-text",
        danger: "border-danger/20 bg-danger-soft text-danger-text",
        violet: "border-violet-200 bg-violet-50 text-violet-800",
        cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
        dark: "border-foreground bg-foreground text-white",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

const dotColor: Record<BadgeTone, string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  dark: "bg-white",
};

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span className={cn("size-1.5 rounded-full", dotColor[tone ?? "neutral"])} />}
      {children}
    </span>
  );
}
