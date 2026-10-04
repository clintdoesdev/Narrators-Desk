import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { QuillMark } from "@/components/QuillMark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-parchment px-6">
      <div className="text-center">
        <QuillMark className="mx-auto mb-6 h-12 w-12 text-ink" />
        <h1 className="t-display text-ink">Nothing here.</h1>
        <Link href="/" className="link t-body mt-4">
          Back to the desk <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
