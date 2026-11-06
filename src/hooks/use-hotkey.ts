"use client";
import * as React from "react";

/** Registers a global keyboard shortcut, e.g. useHotkey("k", fn, { meta: true }). */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void, opts: { meta?: boolean; enabled?: boolean } = {}) {
  const { meta = false, enabled = true } = opts;
  const ref = React.useRef(handler);
  ref.current = handler;
  React.useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (meta && !(e.metaKey || e.ctrlKey)) return;
      if (!meta && (typing || e.metaKey || e.ctrlKey || e.altKey)) return;
      if (e.key.toLowerCase() === key.toLowerCase()) {
        e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, meta, enabled]);
}
