import type { Metadata } from "next";
import { InboundView } from "@/components/modules/inbound/inbound-view";

export const metadata: Metadata = { title: "Inbound Operations" };

export default function Page() {
  return <InboundView />;
}
