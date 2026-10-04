"use client";

import { QuillMark } from "@/components/QuillMark";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-parchment px-6">
      <div className="max-w-md text-center">
        <QuillMark className="mx-auto mb-6 h-12 w-12 text-ink" />
        <h1 className="t-display text-ink">Something went wrong.</h1>
        <p className="t-body mt-3 text-ink-48">
          The desk hit an unexpected error. Your script and generated takes are saved on this device, so nothing is lost.
        </p>
        {error.digest ? <p className="t-fine mt-3 font-mono text-ink-48">ref {error.digest}</p> : null}
        <button type="button" onClick={reset} className="btn btn-primary mt-8">
          Try again
        </button>
      </div>
    </main>
  );
}
