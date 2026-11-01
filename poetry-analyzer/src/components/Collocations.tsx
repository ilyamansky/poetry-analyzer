import { useMemo, useState } from "react";
import type { CollocationEntry } from "../lib/concordance";
import { cn } from "../lib/cn";

interface Props {
  entries: CollocationEntry[];
  onLemmaClick?: (lemma: string) => void;
}

type SortBy = "freq" | "mi";

const TOP_OPTIONS = [20, 50, 100];

export default function Collocations({ entries, onLemmaClick }: Props) {
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("freq");
  const [topN, setTopN] = useState(50);

  const sorted = useMemo(() => {
    const arr = [...entries];
    if (sortBy === "freq") {
      arr.sort((a, b) => b.freq - a.freq || b.mi - a.mi);
    } else {
      arr.sort((a, b) => b.mi - a.mi || b.freq - a.freq);
    }
    return arr.slice(0, topN);
  }, [entries, sortBy, topN]);

  const clickable = typeof onLemmaClick === "function";

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-3 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400">
          <svg
            viewBox="0 0 24 24"
            className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
        <span className="flex-1 text-sm font-medium text-slate-700">
          Коллокации
        </span>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
          {entries.length}
        </span>
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-3 bg-slate-50/60 px-4 py-3 text-sm">
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              {(
                [
                  ["freq", "По частоте"],
                  ["mi", "По MI"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setSortBy(value)}
                  className={cn(
                    "px-3 py-1.5 transition",
                    sortBy === value
                      ? "bg-slate-900 text-white"
                      : "hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-slate-500">
              Показать:
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1"
              >
                {TOP_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    топ-{n}
                  </option>
                ))}
              </select>
            </label>
            {sortBy === "mi" && (
              <span className="text-xs text-slate-400">
                MI &gt; 0 — слово «притягивается» к ключу, MI &lt; 0 —
                «отталкивается».
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Коллокаций не найдено. Возможно, у ключа слишком мало вхождений
              или анализ ещё не запущен.
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 text-left font-medium">Лемма</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Частота
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Стихов</th>
                    <th className="px-4 py-2 text-right font-medium">MI</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => (
                    <tr
                      key={e.lemma}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-4 py-1.5">
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={() => onLemmaClick?.(e.lemma)}
                          className="text-left text-slate-800 hover:text-slate-900 disabled:cursor-default"
                        >
                          {e.lemma}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {e.freq}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                        {e.docs}
                      </td>
                      <td className="px-4 py-1.5 text-right tabular-nums text-slate-500">
                        {e.mi.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
