import type { Metadata } from "next";
import { LocationsView } from "@/components/modules/locations/locations-view";

export const metadata: Metadata = { title: "Locations & Storage" };

export default function Page() {
  return <LocationsView />;
}
