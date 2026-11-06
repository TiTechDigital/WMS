"use client";

import * as React from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WmsStoreProvider } from "@/store/wms-store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WmsStoreProvider>
      <TooltipProvider delayDuration={250}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "!rounded-md !border !border-border !shadow-pop !text-[13px] !font-sans",
              description: "!text-xs !text-muted-foreground",
            },
          }}
        />
      </TooltipProvider>
    </WmsStoreProvider>
  );
}
