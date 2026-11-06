import { Apple, Car, Cpu, Drill, Hammer, HeartPulse, Package, Paperclip, Sofa, type LucideIcon } from "lucide-react";
import type { Category } from "@/types";
import { cn } from "@/lib/utils";

const MAP: Record<Category, { icon: LucideIcon; cls: string }> = {
  Electronics: { icon: Cpu, cls: "bg-blue-50 text-blue-600 border-blue-100" },
  "Power Tools": { icon: Drill, cls: "bg-orange-50 text-orange-600 border-orange-100" },
  "Industrial Supplies": { icon: Hammer, cls: "bg-slate-100 text-slate-600 border-slate-200" },
  Packaging: { icon: Package, cls: "bg-amber-50 text-amber-700 border-amber-100" },
  "Home & Kitchen": { icon: Sofa, cls: "bg-teal-50 text-teal-600 border-teal-100" },
  "Health & Beauty": { icon: HeartPulse, cls: "bg-rose-50 text-rose-600 border-rose-100" },
  "Food & Beverage": { icon: Apple, cls: "bg-green-50 text-green-700 border-green-100" },
  Automotive: { icon: Car, cls: "bg-zinc-100 text-zinc-700 border-zinc-200" },
  "Office Supplies": { icon: Paperclip, cls: "bg-violet-50 text-violet-600 border-violet-100" },
};

export function categoryIcon(c: Category) {
  return MAP[c]?.icon ?? Package;
}

export function ProductThumb({ category, imageUrl, size = "md", className }: { category: Category; imageUrl?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const m = MAP[category] ?? MAP.Packaging;
  const Icon = m.icon;
  const dim = size === "sm" ? "size-7" : size === "md" ? "size-9" : size === "lg" ? "size-14" : "size-full aspect-square";
  if (imageUrl)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={cn("shrink-0 rounded-md border object-cover", dim, className)} />;
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border", m.cls, dim, className)}>
      <Icon className={size === "sm" ? "size-3.5" : size === "md" ? "size-4" : size === "lg" ? "size-6" : "size-14"} strokeWidth={1.6} />
    </span>
  );
}
