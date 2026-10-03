"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { SectionLabel } from "@/components/SectionLabel";
import { summarize } from "@/lib/credits";
import { getMeta, setMeta } from "@/lib/cache";
import { parseScript } from "@/lib/parser";
import { EXAMPLE_SCRIPT } from "@/lib/example";
import { ScriptEditor, type ScriptEditorHandle } from "./ScriptEditor";
import { ValidatePanel } from "./ValidatePanel";
import { useUsage } from "./useUsage";

const SCRIPT_KEY = "script";

export function Desk() {
  const [script, setScript] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const editor = useRef<ScriptEditorHandle>(null);
  const usage = useUsage();

  useEffect(() => {
    getMeta<string>(SCRIPT_KEY)
      .then((s) => {
        if (s) setScript(s);
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const t = window.setTimeout(() => setMeta(SCRIPT_KEY, script).catch(() => {}), 400);
    return () => window.clearTimeout(t);
  }, [script, hydrated]);

  const deferred = useDeferredValue(script);
  const parsed = useMemo(() => parseScript(deferred), [deferred]);
  const summary = useMemo(() => summarize(parsed.chunks), [parsed.chunks]);
  const video = parsed.video || null;

  useEffect(() => {
    document.title = video ? `Narrator's Desk — ${video}` : "Narrator's Desk";
  }, [video]);

  const jump = useCallback((line: number) => editor.current?.jumpToLine(line), []);

  return (
    <div className="min-h-dvh">
      <Header video={video} credits={usage.view} online />
      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-32 lg:px-6">
        <section className="space-y-4">
          <SectionLabel num="01" label="Script" />
          <ScriptEditor
            ref={editor}
            value={script}
            onChange={setScript}
            onLoadExample={() => setScript(EXAMPLE_SCRIPT)}
          />
        </section>
        <section className="space-y-4">
          <SectionLabel num="02" label="Validate" />
          <ValidatePanel
            summary={summary}
            errors={parsed.errors}
            warnings={parsed.warnings}
            remaining={usage.remaining}
            hasScript={script.trim().length > 0}
            onJump={jump}
          />
        </section>
        <SectionLabel num="03" label="Generate" />
        <SectionLabel num="04" label="Audition" />
        <SectionLabel num="05" label="Export" />
      </main>
    </div>
  );
}
