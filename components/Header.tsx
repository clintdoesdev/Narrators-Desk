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
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 lg:px-6">
        <QuillMark className="h-6 w-6 shrink-0 text-brass" />
        <span className="font-display text-lg leading-none tracking-tight whitespace-nowrap">
          Narrator&rsquo;s Desk
        </span>
        {video ? (
          <span className="hidden min-w-0 truncate font-mono text-xs text-ink-muted sm:inline">
            {video}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {!online ? (
            <span className="mr-2 flex items-center gap-1.5 text-xs text-warn" title="Offline">
              <WifiOff className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Offline</span>
            </span>
          ) : null}
          <CreditsBadge credits={credits} />
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
      {video ? (
        <div className="truncate border-t border-line/60 px-4 py-1 font-mono text-[11px] text-ink-muted sm:hidden">
          {video}
        </div>
      ) : null}
    </header>
  );
}

function CreditsBadge({ credits }: { credits: CreditsView }) {
  if (credits.state === "loading") {
    return <span className="px-2 text-xs text-ink-faint">Credits…</span>;
  }
  if (credits.state === "error") {
    return (
      <span className="px-2 text-xs whitespace-nowrap text-error" title={credits.message}>
        <span className="sm:hidden">Credits n/a</span>
        <span className="hidden sm:inline">Credits unavailable</span>
      </span>
    );
  }
  return (
    <span className="px-2 text-right text-xs leading-tight text-ink-muted" title="Remaining ElevenLabs credits">
      <span className="font-mono text-ink tabular-nums">{credits.remaining.toLocaleString()}</span>
      <span className="hidden sm:inline"> credits left</span>
      <span className="sm:hidden"> left</span>
    </span>
  );
}
