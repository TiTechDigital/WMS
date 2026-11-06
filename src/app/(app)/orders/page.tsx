import type { Metadata } from "next";
import { OrdersView } from "@/components/modules/orders/orders-view";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <OrdersView />;
}
