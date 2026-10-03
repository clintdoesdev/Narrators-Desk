"use client";

import { Header } from "@/components/Header";
import { SectionLabel } from "@/components/SectionLabel";

export function Desk() {
  return (
    <div className="min-h-dvh">
      <Header video={null} credits={{ state: "loading" }} online />
      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-32 lg:px-6">
        <SectionLabel num="01" label="Script" />
        <SectionLabel num="02" label="Validate" />
        <SectionLabel num="03" label="Generate" />
        <SectionLabel num="04" label="Audition" />
        <SectionLabel num="05" label="Export" />
      </main>
    </div>
  );
}
