import type { Metadata } from "next";
import { OutboundView } from "@/components/modules/outbound/outbound-view";

export const metadata: Metadata = { title: "Outbound Operations" };

export default function Page() {
  return <OutboundView />;
}
