import { cn } from "@/lib/utils";

const toneClass = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  neutral: "bg-muted-foreground",
} as const;

export type ProgressTone = keyof typeof toneClass;

export function Progress({
  value,
  tone = "primary",
  className,
  size = "sm",
}: {
  value: number;
  tone?: ProgressTone;
  className?: string;
  size?: "xs" | "sm" | "md";
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(v)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "w-full overflow-hidden rounded-full bg-accent",
        size === "xs" ? "h-1" : size === "sm" ? "h-1.5" : "h-2.5",
        className
      )}
    >
      <div className={cn("h-full rounded-full transition-[width]", toneClass[tone])} style={{ width: `${v}%` }} />
    </div>
  );
}

/** Pick a tone from a utilization percentage. */
export function utilizationTone(pct: number): ProgressTone {
  if (pct >= 92) return "danger";
  if (pct >= 80) return "warning";
  return "primary";
}
