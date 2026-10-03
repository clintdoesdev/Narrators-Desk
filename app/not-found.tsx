import Link from "next/link";
import { QuillMark } from "@/components/QuillMark";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="text-center">
        <QuillMark className="mx-auto mb-4 h-10 w-10 text-brass" />
        <h1 className="font-display text-2xl">Nothing here</h1>
        <Link href="/" className="mt-4 inline-flex h-11 items-center text-sm text-brass underline-offset-4 hover:underline">
          Back to the desk
        </Link>
      </div>
    </main>
  );
}
