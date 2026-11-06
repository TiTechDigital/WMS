import type { DailyMetric } from "@/types";
import type { DateRange } from "@/components/shared/date-range-picker";

export function sliceMetrics(m: DailyMetric[], r: DateRange) {
  return m.filter((d) => d.date >= r.from && d.date <= r.to);
}

export function pctChange(curr: number, prev: number) {
  if (!prev) return 0;
  return ((curr - prev) / prev) * 100;
}

/** Compare the last `n` days against the `n` days before. */
export function periodDelta(m: DailyMetric[], key: keyof DailyMetric, n = 7, mode: "sum" | "avg" = "sum") {
  const curr = m.slice(-n);
  const prev = m.slice(-2 * n, -n);
  const agg = (arr: DailyMetric[]) => {
    const s = arr.reduce((a, d) => a + (d[key] as number), 0);
    return mode === "sum" ? s : s / (arr.length || 1);
  };
  return pctChange(agg(curr), agg(prev));
}

/** Bucket daily metrics into weeks when the range is long, for readable bar charts. */
export function bucketMetrics(m: DailyMetric[], maxBars = 31) {
  if (m.length <= maxBars) return m.map((d) => ({ ...d, label: d.date }));
  const size = Math.ceil(m.length / maxBars) <= 7 ? 7 : 30;
  const out: (DailyMetric & { label: string })[] = [];
  for (let i = 0; i < m.length; i += size) {
    const chunk = m.slice(i, i + size);
    const sum = (k: keyof DailyMetric) => chunk.reduce((a, d) => a + (d[k] as number), 0);
    const avg = (k: keyof DailyMetric) => Number((sum(k) / chunk.length).toFixed(1));
    out.push({
      date: chunk[0].date,
      label: chunk[0].date,
      inbound: sum("inbound"),
      outbound: sum("outbound"),
      adjustments: sum("adjustments"),
      stockOnHand: chunk[chunk.length - 1].stockOnHand,
      ordersReceived: sum("ordersReceived"),
      ordersShipped: sum("ordersShipped"),
      onTimeRate: avg("onTimeRate"),
      pickRate: avg("pickRate"),
      avgPickMinutes: avg("avgPickMinutes"),
      accuracy: avg("accuracy"),
      utilization: avg("utilization"),
    });
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDay = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
};
