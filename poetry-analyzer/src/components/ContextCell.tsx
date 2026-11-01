import { Highlight } from "./Highlight";

interface Props {
  prevLines: string[];
  main: string;
  nextLines: string[];
  query: string;
  mode: "word" | "substring" | "none";
  align: "left" | "right";
}

/**
 * Ячейка контекста слева или справа от ключа.
 * Сверху — приглушённые строки-предшественники (для левой) или пусто (для правой).
 * В центре — часть ключевой строки.
 * Снизу — приглушённые последующие строки (для правой).
 */
export default function ContextCell({
  prevLines,
  main,
  nextLines,
  query,
  mode,
  align,
}: Props) {
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <div className={alignClass}>
      {prevLines.length > 0 && (
        <div className="mb-1 space-y-0.5 border-b border-dashed border-slate-200 pb-1 text-xs italic leading-snug text-slate-300">
          {prevLines.map((line, i) => (
            <div key={i} className="line-clamp-2">
              <Highlight text={line} query={query} mode={mode} variant="soft" />
            </div>
          ))}
        </div>
      )}
      <div>
        <Highlight text={main} query={query} mode={mode} variant="soft" />
      </div>
      {nextLines.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-dashed border-slate-200 pt-1 text-xs italic leading-snug text-slate-300">
          {nextLines.map((line, i) => (
            <div key={i} className="line-clamp-2">
              <Highlight text={line} query={query} mode={mode} variant="soft" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
