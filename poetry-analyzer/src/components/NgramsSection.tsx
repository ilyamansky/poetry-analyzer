import { useMemo } from "react";
import { computeNgrams } from "../lib/ngrams";
import { downloadCsv } from "../lib/csv";
import { fmt1 } from "../lib/format";
import { POS_GROUPS } from "../lib/pos";
import { cn } from "../lib/cn";
import { useQueryParams } from "../hooks/useQueryParams";
import { useAnalysisStore } from "../store/analysisStore";
import type { Poem } from "../types";

const TOP_ROWS = 50;

interface Props {
  poemsA: Poem[];
  poemsB: Poem[] | null;
  labelA: string;
  labelB: string | null;
  stopwords: Set<string>;
}

function per100k(count: number, total: number): number {
  return total > 0 ? (count / total) * 100000 : 0;
}

export default function NgramsSection({
  poemsA,
  poemsB,
  labelA,
  labelB,
  stopwords,
}: Props) {
  const analyses = useAnalysisStore((s) => s.analyses);
  const { getParam, setParam } = useQueryParams();

  const n = (getParam("ng-n", "2") === "3" ? 3 : 2) as 2 | 3;
  const stopMode = getParam("ng-stop", "all");
  const posParams = [1, 2, 3].map((i) => getParam(`ng-p${i}`, ""));
  const posKey = posParams.join(",");
  const posPattern = useMemo(
    () =>
      posKey
        .split(",")
        .slice(0, n)
        .map((v) => (v === "" ? null : v)),
    [posKey, n],
  );
  const patternActive = posPattern.some((g) => g != null);

  const opts = useMemo(
    () => ({
      n,
      stopwords,
      includeStopwords: stopMode === "all",
      posPattern,
    }),
    [n, stopwords, stopMode, posPattern],
  );

  const resultA = useMemo(
    () => computeNgrams(poemsA, analyses, opts),
    [poemsA, analyses, opts],
  );
  const resultB = useMemo(
    () => (poemsB ? computeNgrams(poemsB, analyses, opts) : null),
    [poemsB, analyses, opts],
  );

  const comparing = resultB != null && labelB != null;

  const tableRows = useMemo(() => {
    const topA = resultA.rows.slice(0, TOP_ROWS);
    if (!resultB) {
      return topA.map((r) => ({ ngram: r.ngram, a: r.count, b: null as number | null }));
    }
    const map = new Map<string, { a: number; b: number }>();
    for (const r of topA) map.set(r.ngram, { a: r.count, b: 0 });
    for (const r of resultB.rows.slice(0, TOP_ROWS)) {
      const cur = map.get(r.ngram);
      if (cur) cur.b = r.count;
      else map.set(r.ngram, { a: 0, b: r.count });
    }
    return [...map.entries()]
      .sort((x, y) => y[1].a + y[1].b - (x[1].a + x[1].b))
      .map(([ngram, v]) => ({ ngram, a: v.a, b: v.b as number | null }));
  }, [resultA, resultB]);

  const noCoverage = patternActive && resultA.analyzed === 0;

  const handleExport = () => {
    const header = comparing
      ? ["N-грамма", `${labelA}`, `${labelA} на 100 тыс.`, `${labelB}`, `${labelB} на 100 тыс.`]
      : ["N-грамма", "Частота", "На 100 тыс. слов"];
    const body = tableRows.map((r) => {
      const base = [
        r.ngram,
        r.a,
        fmt1(per100k(r.a, resultA.totalTokens)),
      ];
      if (comparing && resultB) {
        base.push(r.b ?? 0, fmt1(per100k(r.b ?? 0, resultB.totalTokens)));
      }
      return base;
    });
    downloadCsv(`ngrams-${n}-${Date.now()}.csv`, [header, ...body]);
  };

  const posSelect = (idx: number) => (
    <select
      key={idx}
      value={posParams[idx]}
      onChange={(e) => setParam(`ng-p${idx + 1}`, e.target.value, "")}
      className={cn(
        "rounded-lg border bg-white px-2 py-1.5",
        posParams[idx] ? "border-slate-900" : "border-slate-300",
      )}
    >
      <option value="">любая ч.р.</option>
      {POS_GROUPS.map((g) => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </select>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">
          N-граммы
          {comparing && (
            <span className="ml-2 text-xs text-slate-400">
              «{labelA}» vs «{labelB}»
            </span>
          )}
        </h2>
        <button
          onClick={handleExport}
          disabled={tableRows.length === 0}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Экспорт CSV
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-600">
          Длина:
          <select
            value={String(n)}
            onChange={(e) => setParam("ng-n", e.target.value, "2")}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            <option value="2">Биграммы</option>
            <option value="3">Триграммы</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-slate-600">
          Стоп-слова:
          <select
            value={stopMode}
            onChange={(e) => setParam("ng-stop", e.target.value, "all")}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            <option value="all">Учитывать</option>
            <option value="content">Исключить</option>
          </select>
        </label>

        <span className="flex items-center gap-1 text-slate-600">
          Паттерн ч.р.: {[...Array(n)].map((_, i) => posSelect(i))}
        </span>
      </div>

      {noCoverage ? (
        <p className="text-sm text-slate-600">
          Фильтр по частям речи требует анализа корпуса — запустите
          лемматизацию кнопкой «Лемматизация (быстро)» ниже на этой странице.
        </p>
      ) : tableRows.length === 0 ? (
        <p className="text-sm text-slate-500">Нет данных для отображения.</p>
      ) : (
        <div className="max-h-105 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="py-2 pr-4 font-medium">N-грамма</th>
                <th className="px-3 py-2 text-right font-medium">
                  {comparing ? labelA : "Частота"}
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  на 100 тыс.
                </th>
                {comparing && (
                  <>
                    <th className="px-3 py-2 text-right font-medium">
                      {labelB}
                    </th>
                    <th className="py-2 pl-3 text-right font-medium">
                      на 100 тыс.
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr
                  key={r.ngram}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-1.5 pr-4 text-slate-700">{r.ngram}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{r.a}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                    {fmt1(per100k(r.a, resultA.totalTokens))}
                  </td>
                  {comparing && resultB && (
                    <>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {r.b}
                      </td>
                      <td className="py-1.5 pl-3 text-right tabular-nums text-slate-500">
                        {fmt1(per100k(r.b ?? 0, resultB.totalTokens))}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!noCoverage && patternActive && (
        <p className="mt-2 text-xs text-slate-400">
          Паттерн применён к {resultA.analyzed} из {poemsA.length} стихов (с
          анализом).
        </p>
      )}
    </div>
  );
}
