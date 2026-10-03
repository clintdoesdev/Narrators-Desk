import type { Metadata } from "next";
import { QuillMark } from "@/components/QuillMark";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Narrator's Desk — Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <QuillMark className="mb-4 h-12 w-12 text-brass" />
          <h1 className="font-display text-4xl tracking-tight text-ink">Narrator&rsquo;s Desk</h1>
          <p className="mt-2 text-sm text-ink-muted">Serious History voice room</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
