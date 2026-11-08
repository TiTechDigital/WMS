import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border bg-surface shadow-card", className)} {...props} />;
}

export function CardHeader({
  className,
  title,
  description,
  actions,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b px-4 py-3", className)} {...props}>
      <div className="min-w-0">
        {title && <h2 className="text-[13px] font-semibold leading-5 text-foreground">{title}</h2>}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center border-t px-4 py-2.5", className)} {...props} />;
}
