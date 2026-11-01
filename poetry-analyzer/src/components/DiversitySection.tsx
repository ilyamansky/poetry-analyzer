import { useMemo } from "react";
import CompareTable from "./CompareTable";
import { MATTR_WINDOW, computeDiversity } from "../lib/diversity";
import { fmt, fmt1 } from "../lib/format";
import type { Poem } from "../types";

interface Props {
  poemsA: Poem[];
  poemsB: Poem[] | null;
  labelA: string;
  labelB: string | null;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1).replace(".", ",")}%`;
}

export default function DiversitySection({
  poemsA,
  poemsB,
  labelA,
  labelB,
}: Props) {
  const statsA = useMemo(() => computeDiversity(poemsA), [poemsA]);
  const statsB = useMemo(
    () => (poemsB ? computeDiversity(poemsB) : null),
    [poemsB],
  );

  const comparing = statsB != null && labelB != null;

  const mattrLabel = `MATTR (окно ${MATTR_WINDOW})`;

  if (comparing && statsB) {
    const rows = [
      {
        label: "TTR (уникальные / все)",
        a: pct(statsA.ttr),
        b: pct(statsB.ttr),
        delta: (statsA.ttr - statsB.ttr) * 100,
        unit: " п.п.",
      },
      {
        label: mattrLabel,
        a: statsA.mattr != null ? pct(statsA.mattr) : "—",
        b: statsB.mattr != null ? pct(statsB.mattr) : "—",
        delta:
          statsA.mattr != null && statsB.mattr != null
            ? (statsA.mattr - statsB.mattr) * 100
            : null,
        unit: " п.п.",
      },
      {
        label: "Хапаксы (доля типов)",
        a: `${fmt1(statsA.hapaxPercent)}%`,
        b: `${fmt1(statsB.hapaxPercent)}%`,
        delta: statsA.hapaxPercent - statsB.hapaxPercent,
        unit: " п.п.",
      },
      {
        label: "Средняя длина слова, зн.",
        a: fmt1(statsA.meanWordLength),
        b: fmt1(statsB.meanWordLength),
        delta: statsA.meanWordLength - statsB.meanWordLength,
      },
      {
        label: "Слов в строке",
        a: fmt1(statsA.meanLineLength),
        b: fmt1(statsB.meanLineLength),
        delta: statsA.meanLineLength - statsB.meanLineLength,
      },
      {
        label: "Слов в стихотворении",
        a: fmt1(statsA.meanPoemLength),
        b: fmt1(statsB.meanPoemLength),
        delta: statsA.meanPoemLength - statsB.meanPoemLength,
      },
    ];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-medium text-slate-700">
          Лексическое разнообразие
        </h2>
        <CompareTable labelA={labelA} labelB={labelB} rows={rows} />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-700">
        Лексическое разнообразие
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi label="TTR (уникальные / все)" value={pct(statsA.ttr)} />
        <Kpi
          label={mattrLabel}
          value={statsA.mattr != null ? pct(statsA.mattr) : "—"}
        />
        <Kpi
          label="Хапаксы (доля типов)"
          value={`${fmt1(statsA.hapaxPercent)}%`}
        />
        <Kpi
          label="Средняя длина слова"
          value={`${fmt1(statsA.meanWordLength)} зн.`}
        />
        <Kpi label="Слов в строке" value={fmt1(statsA.meanLineLength)} />
        <Kpi
          label="Слов в стихотворении"
          value={fmt1(statsA.meanPoemLength)}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Токенов: {fmt(statsA.totalTokens)}, типов: {fmt(statsA.uniqueTokens)},
        хапаксов: {fmt(statsA.hapaxCount)}. MATTR — средний TTR по скользящему
        окну в {MATTR_WINDOW} слов над склеенным корпусом.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
