import { cn } from "../lib/cn";

export function ChevronRight({
  className,
  open = false,
}: {
  className?: string;
  open?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(
        "h-4 w-4 transition-transform",
        open && "rotate-90",
        className,
      )}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
