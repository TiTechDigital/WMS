import { Badge, type BadgeTone } from "@/components/ui/badge";

export function StatusBadge<K extends string>({ map, value, dot = true }: { map: Record<K, { label: string; tone: BadgeTone }>; value: K; dot?: boolean }) {
  const m = map[value];
  if (!m) return <Badge>{value}</Badge>;
  return (
    <Badge tone={m.tone} dot={dot}>
      {m.label}
    </Badge>
  );
}
