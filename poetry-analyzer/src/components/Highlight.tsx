import { cn } from "../lib/cn";
import { escapeRegExp } from "../lib/regex";

interface Props {
  text: string;
  query: string | string[];
  /** 'substring' — любая подстрока, 'word' — только целые слова, 'none' — без подсветки. */
  mode?: "substring" | "word" | "none";
  /** 'soft' — бледный жёлтый для контекста, чтобы не конкурировать с ключом. */
  variant?: "primary" | "soft";
  className?: string;
}

export function Highlight({
  text,
  query,
  mode = "substring",
  variant = "primary",
  className,
}: Props) {
  const queries = (Array.isArray(query) ? query : [query])
    .map((q) => q.trim())
    .filter(Boolean);

  if (queries.length === 0 || mode === "none") return <>{text}</>;

  const alternatives = [...queries]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  // word-границы: кириллица не входит в \b, используем lookaround
  const pattern =
    mode === "word"
      ? `(?<![а-яёa-z])(${alternatives})(?![а-яёa-z])`
      : `(${alternatives})`;
  const parts = text.split(new RegExp(pattern, "gi"));

  const lowered = new Set(queries.map((q) => q.toLowerCase()));

  return (
    <>
      {parts.map((part, i) =>
        lowered.has(part.toLowerCase()) ? (
          <mark
            key={i}
            className={cn(
              "rounded px-0.5",
              variant === "primary"
                ? "bg-yellow-200 text-slate-900"
                : "bg-yellow-100 text-slate-700",
              className,
            )}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
