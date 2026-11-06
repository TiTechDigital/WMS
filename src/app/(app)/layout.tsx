import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-accent/60" />}>{children}</Suspense>
    </AppShell>
  );
}
