"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Opens UI (e.g. a "create" dialog) when a URL query flag such as `?new=1` is present,
 * then strips the flag. Lets global quick-actions deep-link into page-level dialogs.
 */
export function useQueryFlag(flag: string, onPresent: (value: string) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const cb = React.useRef(onPresent);
  cb.current = onPresent;
  const value = params.get(flag);
  React.useEffect(() => {
    if (value == null) return;
    cb.current(value);
    const next = new URLSearchParams(params.toString());
    next.delete(flag);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [value, flag, params, pathname, router]);
}

/** Read-only initial value from the URL (for filters linked from other pages). */
export function useInitialParam(name: string) {
  const params = useSearchParams();
  return React.useMemo(() => params.get(name), []); // eslint-disable-line react-hooks/exhaustive-deps
}
