import { Link } from "react-router-dom";
import type { Poem } from "../types";
import { cn } from "../lib/cn";
import { Highlight } from "./Highlight";

interface Props {
  poem: Poem;
  query?: string;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function getSnippet(content: string, query: string, context = 80) {
  const q = query.trim();
  if (!q) return null;
  const idx = content.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return null;
  const start = Math.max(0, idx - context);
  const end = Math.min(content.length, idx + q.length + context);
  return {
    text: content.slice(start, end),
    prefix: start > 0 ? "…" : "",
    suffix: end < content.length ? "…" : "",
  };
}

export default function PoemCard({
  poem,
  query = "",
  selected = false,
  onToggleSelect,
}: Props) {
  const lines = poem.content.split("\n").filter((l) => l.trim().length > 0);
  const snippet = getSnippet(poem.content, query);
  const selectable = typeof onToggleSelect === "function";

  return (
    <Link
      to={`/poems/${poem.id}`}
      className={cn(
        "relative block rounded-xl border bg-white p-5 transition hover:border-slate-400 hover:shadow-sm",
        selected ? "border-slate-900 bg-slate-50" : "border-slate-200",
        selectable && "pl-12",
      )}
    >
      {selectable && (
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-label={`Выбрать стихотворение ${poem.index}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect?.(poem.id);
          }}
          className={cn(
            "absolute left-4 top-6 flex h-5 w-5 items-center justify-center rounded border transition",
            selected
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white hover:border-slate-500",
          )}
        >
          {selected && (
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M3 8l3.5 3.5L13 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      )}

      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold text-slate-900">
          Стихотворение {poem.index}
        </h3>
        <span className="shrink-0 text-xs text-slate-400">
          {lines.length} стр.
        </span>
      </div>

      {snippet ? (
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
          {snippet.prefix}
          <Highlight text={snippet.text} query={query} />
          {snippet.suffix}
        </p>
      ) : (
        <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm text-slate-600">
          {lines.slice(0, 4).join("\n")}
        </p>
      )}
    </Link>
  );
}
