import type { Metadata } from "next";
import { SuppliersView } from "@/components/modules/suppliers/suppliers-view";

export const metadata: Metadata = { title: "Suppliers" };

export default function Page() {
  return <SuppliersView />;
}
