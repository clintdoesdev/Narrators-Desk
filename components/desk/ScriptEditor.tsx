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
    "px-4 py-4 pl-14 font-mono text-[13px] leading-[1.65] whitespace-pre-wrap break-words [overflow-wrap:anywhere] [font-variant-ligatures:none]";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <button type="button" onClick={onLoadExample} className="link t-body flex h-11 items-center gap-1.5">
          <FileText className="h-4 w-4" aria-hidden="true" /> Load example
        </button>
        <button type="button" onClick={paste} className="link t-body flex h-11 items-center gap-1.5">
          <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Paste
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="t-body ml-auto flex h-11 items-center gap-1.5 text-ink-48 transition-colors hover:text-ink"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Clear
          </button>
        ) : null}
      </div>
      <div
        ref={scroller}
        className="relative max-h-[60vh] min-h-56 overflow-x-hidden overflow-y-auto rounded-[18px] bg-parchment transition-shadow focus-within:shadow-[inset_0_0_0_2px_var(--primary-focus)]"
      >
        <div className="relative min-h-56">
          <div ref={mirror} className={`${shared} text-transparent select-none`} aria-hidden="true">
            {lines.map((l, i) => (
              <div
                key={i}
                data-n={i + 1}
                className={`relative rounded-sm transition-colors duration-500 before:absolute before:-left-11 before:w-7 before:text-right before:text-[11px] before:text-ink-32 before:content-[attr(data-n)] ${
                  flash === i + 1 ? "bg-primary/15" : ""
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
            className={`${shared} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-ink caret-primary placeholder:text-ink-32 focus:outline-none focus-visible:outline-none`}
          />
        </div>
      </div>
      <p className="t-fine text-ink-48">
        {lines.length.toLocaleString()} lines · {value.length.toLocaleString()} characters · kept on this device for 24 hours
      </p>
    </div>
  );
});
