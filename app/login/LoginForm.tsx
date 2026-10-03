"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2, LockKeyhole } from "lucide-react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.replace("/");
        return;
      }
      const body = (await res.json().catch(() => null)) as { detail?: string } | null;
      setError(body?.detail ?? `Sign-in failed (status ${res.status}).`);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 focus-within:border-brass">
        <LockKeyhole className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-faint focus:outline-none focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!password || pending}
          aria-label="Sign in"
          className="-mr-1.5 flex h-10 w-11 items-center justify-center rounded-md bg-brass text-brass-ink transition-colors hover:bg-brass-strong disabled:bg-surface-3 disabled:text-ink-faint"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p role="alert" aria-live="polite" className="min-h-5 text-sm text-error">
        {error}
      </p>
    </form>
  );
}
