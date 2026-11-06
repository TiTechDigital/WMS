import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";

const palette = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-slate-200 text-slate-700",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        palette[hash(name) % palette.length],
        size === "xs" && "size-5 text-[9px]",
        size === "sm" && "size-6 text-2xs",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-11 text-sm",
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
