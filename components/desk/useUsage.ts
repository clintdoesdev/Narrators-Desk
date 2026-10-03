"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreditsView } from "@/components/Header";

type Usage = {
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number | null;
  tier: string;
};

export type UsageState = {
  view: CreditsView;
  remaining: number | null;
  resetAt: number | null;
  tier: string | null;
  refresh: () => Promise<number | null>;
};

export function useUsage(): UsageState {
  const [view, setView] = useState<CreditsView>({ state: "loading" });
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [tier, setTier] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<number | null> => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (res.status === 401) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === "unauthorized") {
          window.location.replace("/login");
          return null;
        }
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { detail?: string } | null;
        setView({ state: "error", message: `${body?.detail ?? "Couldn't load credits."} (status ${res.status})` });
        return null;
      }
      const u = (await res.json()) as Usage;
      const remaining = Math.max(0, u.character_limit - u.character_count);
      setView({ state: "ok", remaining, limit: u.character_limit });
      setResetAt(u.next_character_count_reset_unix);
      setTier(u.tier);
      return remaining;
    } catch {
      setView({ state: "error", message: "Can't reach the server." });
      return null;
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount; refresh() only sets state after awaiting the network.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return { view, remaining: view.state === "ok" ? view.remaining : null, resetAt, tier, refresh };
}
