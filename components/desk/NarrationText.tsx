import { Fragment } from "react";

const TOKEN_RE = /(\[[^\]]+\]|<break\b[^>]*>)/g;

/** Narration with Audio Tags and inline breaks highlighted. */
export function NarrationText({ text }: { text: string }) {
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const isBreak = part.startsWith("<");
        return (
          <span
            key={i}
            className={`rounded px-1 py-px font-mono text-[0.82em] ${
              isBreak ? "bg-surface-3 text-ink-muted" : "bg-tag/10 text-tag"
            }`}
          >
            {part}
          </span>
        );
      })}
    </>
  );
}
