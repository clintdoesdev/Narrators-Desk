"use client";

import { LogOut, WifiOff } from "lucide-react";
import { QuillMark } from "./QuillMark";

export type CreditsView =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok"; remaining: number; limit: number };

export function Header({
  video,
  credits,
  online,
}: {
  video: string | null;
  credits: CreditsView;
  online: boolean;
}) {
  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2.5 px-4 lg:px-8">
        <QuillMark className="h-[22px] w-[22px] shrink-0 text-brass" />
        <span className="font-display text-[19px] leading-none tracking-tight whitespace-nowrap">Narrator&rsquo;s Desk</span>
        {video ? (
          <>
            <span className="hidden text-line-strong sm:inline" aria-hidden="true">
              /
            </span>
            <span className="hidden min-w-0 truncate font-mono text-xs text-ink-muted sm:inline" title={video}>
              {video}
            </span>
          </>
        ) : null}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!online ? (
            <span className="mr-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-warn" title="Offline">
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          ) : null}
          <CreditsMeter credits={credits} />
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="h-[17px] w-[17px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

function CreditsMeter({ credits }: { credits: CreditsView }) {
  if (credits.state === "loading") {
    return <span className="h-2 w-16 animate-pulse rounded-full bg-surface-3" aria-label="Loading credits" />;
  }
  if (credits.state === "error") {
    return (
      <span className="px-1 text-xs whitespace-nowrap text-error" title={credits.message}>
        <span className="sm:hidden">Credits n/a</span>
        <span className="hidden sm:inline">Credits unavailable</span>
      </span>
    );
  }
  const left = credits.limit ? credits.remaining / credits.limit : 0;
  return (
    <span className="flex flex-col items-end gap-1 px-1" title={`${credits.remaining.toLocaleString()} of ${credits.limit.toLocaleString()} credits left`}>
      <span className="font-mono text-[11px] leading-none text-ink tabular">
        {credits.remaining.toLocaleString()}
        <span className="text-ink-faint"> left</span>
      </span>
      <span className="block h-[3px] w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <span
          className={`block h-full rounded-full ${left < 0.1 ? "bg-error" : left < 0.25 ? "bg-warn" : "bg-brass"}`}
          style={{ width: `${Math.max(2, left * 100)}%` }}
        />
      </span>
    </span>
  );
}
