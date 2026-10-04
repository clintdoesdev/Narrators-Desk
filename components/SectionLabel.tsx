import type { ReactNode } from "react";

/** Section head: a quiet numeral and a tight 600-weight headline. */
export function SectionLabel({
  num,
  label,
  aside,
  id,
  dark,
  center,
}: {
  num: string;
  label: string;
  aside?: ReactNode;
  id?: string;
  dark?: boolean;
  center?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-end gap-x-4 gap-y-1 ${center ? "justify-center text-center" : ""}`}>
      <h2 id={id} className={`t-display ${dark ? "text-on-dark" : "text-ink"}`}>
        <span className={`mr-3 font-normal tabular ${dark ? "text-on-dark-muted/70" : "text-ink-32"}`} aria-hidden="true">
          {num}
        </span>
        {label}.
      </h2>
      {aside ? (
        <div className={`t-caption pb-1.5 ${center ? "w-full" : "ml-auto"} ${dark ? "text-on-dark-muted" : "text-ink-48"}`}>
          {aside}
        </div>
      ) : null}
    </div>
  );
}
