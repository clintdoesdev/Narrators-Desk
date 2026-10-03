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
    <div className="flex items-center gap-3" id={id}>
      <span className="font-display text-xl leading-none text-brass tabular-nums">{num}</span>
      <h2 className="text-[15px] font-medium tracking-tight text-ink">{label}</h2>
      <span className="h-px flex-1 bg-line" aria-hidden="true" />
      {aside ? <div className="shrink-0 text-sm text-ink-muted">{aside}</div> : null}
    </div>
  );
}
