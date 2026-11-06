import type { Metadata } from "next";
import { TransfersView } from "@/components/modules/transfers/transfers-view";

export const metadata: Metadata = { title: "Stock Transfers" };

export default function Page() {
  return <TransfersView />;
}
