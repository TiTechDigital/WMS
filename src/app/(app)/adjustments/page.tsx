import type { Metadata } from "next";
import { AdjustmentsView } from "@/components/modules/adjustments/adjustments-view";

export const metadata: Metadata = { title: "Stock Adjustments" };

export default function Page() {
  return <AdjustmentsView />;
}
