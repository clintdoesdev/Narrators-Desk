"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

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
    <form onSubmit={onSubmit}>
      <label htmlFor="password" className="sr-only">
        Password
      </label>
      <div
        className={`flex h-14 items-center rounded-full bg-canvas pr-1.5 pl-6 transition-shadow ${
          error ? "shadow-[inset_0_0_0_2px_var(--error)]" : "shadow-[inset_0_0_0_1px_var(--hairline)] focus-within:shadow-[inset_0_0_0_2px_var(--primary-focus)]"
        }`}
      >
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink placeholder:text-ink-32 focus:outline-none focus-visible:outline-none"
        />
        <button
          type="submit"
          disabled={!password || pending}
          aria-label="Sign in"
          className="btn btn-primary h-11 w-11 shrink-0 !px-0"
        >
          {pending ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>
      <p role="alert" aria-live="polite" className="t-caption mt-3 min-h-5 text-error">
        {error}
      </p>
    </form>
  );
}
