import type { ReactNode } from "react";

/** Section label: serif numeral, plain label, hairline rule running out right. */
export function SectionLabel({
  num,
  label,
  aside,
  id,
}: {
  num: string;
  label: string;
  aside?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-display text-[26px] leading-none font-light text-brass/80 tabular" aria-hidden="true">
        {num}
      </span>
      <h2 id={id} className="text-[15px] font-medium tracking-tight text-ink">
        {label}
      </h2>
      <span className="h-px flex-1 translate-y-[-4px] bg-gradient-to-r from-line-strong via-line to-transparent" aria-hidden="true" />
      {aside ? <div className="shrink-0 font-mono text-[11px] text-ink-muted">{aside}</div> : null}
    </div>
  );
}
