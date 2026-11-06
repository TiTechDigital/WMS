import type { Metadata } from "next";
import { PickingView } from "@/components/modules/picking/picking-view";

export const metadata: Metadata = { title: "Picking & Packing" };

export default function Page() {
  return <PickingView />;
}
