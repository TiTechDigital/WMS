import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "Halden";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#2563EB" />
      <path d="M8 22V10l8 4.5L24 10v12" fill="none" stroke="white" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M16 14.5V24" stroke="white" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
