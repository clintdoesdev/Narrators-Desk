"use client";

import { useEffect } from "react";

type Sentinel = { released: boolean; release: () => Promise<void> };
type WakeLockNav = Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };

/** Holds a screen wake lock while `active`, re-acquiring when the tab returns. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as WakeLockNav;
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let disposed = false;

    const acquire = async () => {
      if (disposed || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        sentinel = await nav.wakeLock!.request("screen");
        if (disposed) void sentinel.release();
      } catch {
        // Denied (battery saver, unsupported). Nothing to do.
      }
    };
    const onVisible = () => void acquire();

    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (sentinel && !sentinel.released) void sentinel.release();
    };
  }, [active]);
}
