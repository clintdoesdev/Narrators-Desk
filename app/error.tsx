"use client";

import { RotateCcw } from "lucide-react";
import { QuillMark } from "@/components/QuillMark";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <QuillMark className="mx-auto mb-4 h-10 w-10 text-error" />
        <h1 className="font-display text-2xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The desk hit an unexpected error. Your script and generated takes are saved on this device, so nothing is lost.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-ink-faint">ref {error.digest}</p> : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-5 text-sm font-medium text-brass-ink hover:bg-brass-strong"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
        </button>
      </div>
    </main>
  );
}
