"use client";

import type { ReactNode } from "react";
import { LogOut, WifiOff } from "lucide-react";
import { QuillMark } from "./QuillMark";

export type CreditsView =
  | { state: "loading" }
  | { state: "error"; message: string }
  | { state: "ok"; remaining: number; limit: number };

const NAV = [
  { href: "#script", label: "Script" },
  { href: "#validate", label: "Validate" },
  { href: "#generate", label: "Generate" },
  { href: "#audition", label: "Audition" },
  { href: "#export", label: "Export" },
];

/** Apple-style two-row nav: a thin black global bar, then a frosted sticky sub-nav. */
export function Header({
  video,
  credits,
  online,
  action,
}: {
  video: string | null;
  credits: CreditsView;
  online: boolean;
  action?: ReactNode;
}) {
  async function logout() {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.replace("/login");
    }
  }

  return (
    <>
      <nav className="bg-black text-on-dark" aria-label="Sections">
        <div className="mx-auto flex h-11 max-w-[1024px] items-center gap-6 px-4">
          <a href="#script" aria-label="Narrator's Desk" className="flex h-11 items-center">
            <QuillMark className="h-[18px] w-[18px]" />
          </a>
          <ul className="hidden flex-1 items-center justify-center gap-9 md:flex">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} className="t-fine text-on-dark/80 transition-colors hover:text-on-dark">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            {!online ? (
              <span className="t-fine mr-2 flex items-center gap-1.5 text-warn-on-dark">
                <WifiOff className="h-3.5 w-3.5" aria-hidden="true" /> Offline
              </span>
            ) : null}
            <button
              type="button"
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="-mr-3 flex h-11 w-11 items-center justify-center text-on-dark/80 transition-colors hover:text-on-dark"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      <div className="frosted sticky top-0 z-30 shadow-[0_1px_0_rgb(0_0_0/0.08)]">
        <div className="mx-auto flex h-[52px] max-w-[1024px] items-center gap-4 px-4">
          <div className="min-w-0 flex-1">
            <p className="t-tagline truncate text-ink">Narrator&rsquo;s Desk</p>
          </div>
          {video ? (
            <span className="t-caption hidden max-w-[16rem] truncate font-mono text-ink-48 lg:inline" title={video}>
              {video}
            </span>
          ) : null}
          <Credits credits={credits} />
          {action ? <div className="hidden md:block">{action}</div> : null}
        </div>
      </div>
    </>
  );
}

function Credits({ credits }: { credits: CreditsView }) {
  if (credits.state === "loading") {
    return <span className="t-caption text-ink-32">Credits…</span>;
  }
  if (credits.state === "error") {
    return (
      <a href="#generate" className="t-caption whitespace-nowrap text-error underline-offset-2 hover:underline" title={credits.message}>
        Credits unavailable
      </a>
    );
  }
  return (
    <span
      className="t-caption whitespace-nowrap text-ink-48"
      title={`${credits.remaining.toLocaleString()} of ${credits.limit.toLocaleString()} credits left`}
    >
      <span className="t-caption-strong text-ink tabular">{credits.remaining.toLocaleString()}</span> credits left
    </span>
  );
}
