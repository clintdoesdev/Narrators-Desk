import type { Metadata } from "next";
import { QuillMark } from "@/components/QuillMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Narrator's Desk — Sign in" };

const STEPS = [
  { title: "Paste.", body: "Drop in the full script. Visuals, skits and fact-checks are ignored." },
  { title: "Validate.", body: "Every chunk is checked before a single credit is spent." },
  { title: "Generate.", body: "Several takes of every paragraph, in your voice, cached on the device." },
  { title: "Export.", body: "One ordered zip, picks and manifest included, ready for Premiere." },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <nav className="flex h-11 items-center justify-center bg-black text-on-dark">
        <QuillMark className="h-5 w-5" />
      </nav>

      <main className="flex flex-1 flex-col">
        <section className="flex flex-1 flex-col items-center justify-center bg-canvas px-6 py-20 text-center md:py-28">
          <QuillMark className="mb-6 h-14 w-14 text-ink" />
          <h1 className="t-hero text-ink">Narrator&rsquo;s Desk.</h1>
          <p className="t-lead mt-3 max-w-md text-balance text-ink-48">Serious History, read aloud. Every take, in order.</p>
          <div className="mt-10 w-full max-w-sm">
            <LoginForm />
          </div>
        </section>

        <section className="bg-tile px-6 py-16 text-on-dark md:py-20">
          <ol className="mx-auto grid max-w-[980px] gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <p className="t-caption text-on-dark-muted tabular">0{i + 1}</p>
                <h2 className="t-tagline mt-1">{s.title}</h2>
                <p className="t-caption mt-2 text-on-dark-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="bg-parchment px-6 py-5 text-center">
        <p className="t-fine text-ink-48">Private tool. One narrator, one password.</p>
      </footer>
    </div>
  );
}
