import type { Metadata } from "next";
import { CustomersView } from "@/components/modules/customers/customers-view";

export const metadata: Metadata = { title: "Customers" };

export default function Page() {
  return <CustomersView />;
}
