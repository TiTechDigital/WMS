import type { Metadata } from "next";
import { ActivityView } from "@/components/modules/activity/activity-view";

export const metadata: Metadata = { title: "Activity Logs" };

export default function Page() {
  return <ActivityView />;
}
