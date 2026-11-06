import { REFERENCE_NOW } from "@/lib/constants";

const nf = new Intl.NumberFormat("en-US");
const nfCompact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const cf = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cf2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export const formatNumber = (n: number) => nf.format(n);
export const formatCompact = (n: number) => nfCompact.format(n);
export const formatCurrency = (n: number, cents = false) => (cents ? cf2 : cf).format(n);
export const formatPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** Deterministic (timezone-stable) date formatting — avoids SSR/CSR hydration drift. */
export function formatDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function formatShortDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}
export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${formatShortDate(iso)}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function formatTime(iso: string) {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
export function formatRelative(iso: string, now: Date = REFERENCE_NOW) {
  const diff = now.getTime() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  let s: string;
  if (m < 1) return "just now";
  if (m < 60) s = `${m}m`;
  else if (m < 60 * 24) s = `${Math.round(m / 60)}h`;
  else s = `${Math.round(m / 1440)}d`;
  return future ? `in ${s}` : `${s} ago`;
}
export function toISODate(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
