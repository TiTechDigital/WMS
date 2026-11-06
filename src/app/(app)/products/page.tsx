import type { Metadata } from "next";
import { ProductsView } from "@/components/modules/products/products-view";

export const metadata: Metadata = { title: "Products / SKU Catalog" };

export default function Page() {
  return <ProductsView />;
}
