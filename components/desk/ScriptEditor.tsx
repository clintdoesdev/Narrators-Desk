"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ClipboardPaste, FileText, Trash2 } from "lucide-react";

export type ScriptEditorHandle = { jumpToLine: (line: number) => void };

/**
 * Monospace script editor with soft-wrapped line numbers. A hidden mirror layer
 * renders each source line with identical wrapping to size the gutter, so line
 * numbers stay aligned on narrow phones without horizontal scroll.
 */
export const ScriptEditor = forwardRef<
  ScriptEditorHandle,
  { value: string; onChange: (v: string) => void; onLoadExample: () => void }
>(function ScriptEditor({ value, onChange, onLoadExample }, ref) {
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mirror = useRef<HTMLDivElement>(null);
  const [flash, setFlash] = useState<number | null>(null);

  const lines = value.split("\n");

  useImperativeHandle(ref, () => ({
    jumpToLine(line: number) {
      const ta = textarea.current;
      const sc = scroller.current;
      const row = mirror.current?.children[line - 1] as HTMLElement | undefined;
      if (!ta || !sc) return;
      sc.scrollIntoView({ behavior: "smooth", block: "start" });
      if (row) sc.scrollTo({ top: Math.max(0, row.offsetTop - sc.clientHeight / 3), behavior: "smooth" });
      let offset = 0;
      for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
      const end = offset + (lines[line - 1]?.length ?? 0);
      ta.focus({ preventScroll: true });
      ta.setSelectionRange(offset, end);
      setFlash(line);
      window.setTimeout(() => setFlash((f) => (f === line ? null : f)), 1600);
    },
  }));

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(text);
    } catch {
      textarea.current?.focus();
    }
  }

  const shared =
    "px-3 py-3 pl-12 font-mono [font-variant-ligatures:none] text-[13px] leading-[1.6] whitespace-pre-wrap break-words [overflow-wrap:anywhere] lg:text-[13.5px]";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <button
          type="button"
          onClick={onLoadExample}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-brass underline-offset-4 hover:underline"
        >
          <FileText className="h-4 w-4" aria-hidden="true" /> Load example
        </button>
        <button
          type="button"
          onClick={paste}
          className="inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-ink-muted hover:text-ink"
        >
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Paste
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-md px-2 text-ink-muted hover:text-ink"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear
          </button>
        ) : null}
      </div>
      <div
        ref={scroller}
        className="relative max-h-[55vh] min-h-48 overflow-y-auto overflow-x-hidden rounded-lg border border-line bg-surface focus-within:border-line-strong lg:max-h-[46vh]"
      >
        <div className="relative min-h-48">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-9 border-r border-line/70 bg-surface-2/40" aria-hidden="true" />
        <div ref={mirror} className={`${shared} text-transparent select-none`} aria-hidden="true">
          {lines.map((l, i) => (
            <div
              key={i}
              data-n={i + 1}
              className={`relative transition-colors duration-500 before:absolute before:-left-11 before:w-8 before:text-right before:text-[11px] before:text-ink-faint before:content-[attr(data-n)] ${
                flash === i + 1 ? "bg-brass-dim" : ""
              }`}
            >
              {l || " "}
            </div>
          ))}
        </div>
        <textarea
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Narration script"
          placeholder={"@@VIDEO: my-video-slug\n\n== S1: Story title ==\n[AUDIO — v2]\nPaste your script here…"}
          className={`${shared} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-ink caret-brass placeholder:text-ink-faint focus:outline-none`}
        />
        </div>
      </div>
      <p className="text-xs text-ink-faint">
        {lines.length.toLocaleString()} lines · {value.length.toLocaleString()} characters · saved on this device
      </p>
    </div>
  );
});
