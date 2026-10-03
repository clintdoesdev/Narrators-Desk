/** Monoline quill nib resting on a desk line. Inherits `currentColor`. */
export function QuillMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M32 47 L23 31 C23 22 27 15 32 11 C37 15 41 22 41 31 Z" />
      <path d="M32 47 V30" />
      <circle cx="32" cy="27" r="2.2" />
      <path d="M10 53 H54" />
    </svg>
  );
}
