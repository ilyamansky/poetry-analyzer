import type { LemmaScore } from "../lib/compare";

interface Props {
  scores: LemmaScore[];
  labelA: string;
  labelB: string;
  topN?: number;
  onLemmaClick?: (lemma: string) => void;
}

export default function LemmaScoreTable({
  scores,
  labelA,
  labelB,
  topN = 20,
  onLemmaClick,
}: Props) {
  const topA = [...scores]
    .filter((x) => x.logOdds > 0 && x.countA >= 2)
    .sort((x, y) => y.logOdds - x.logOdds)
    .slice(0, topN);

  const topB = [...scores]
    .filter((x) => x.logOdds < 0 && x.countB >= 2)
    .sort((x, y) => x.logOdds - y.logOdds)
    .slice(0, topN);

  const clickable = typeof onLemmaClick === "function";

  const renderRow = (x: LemmaScore, which: "a" | "b") => (
    <li
      key={x.name}
      className="flex items-center justify-between gap-3 border-b border-slate-100 py-1 last:border-0"
    >
      <button
        type="button"
        disabled={!clickable}
        onClick={() => onLemmaClick?.(x.name)}
        className="text-left text-sm text-slate-800 hover:text-slate-900 disabled:cursor-default"
      >
        {x.name}
      </button>
      <span className="shrink-0 text-xs tabular-nums text-slate-500">
        {which === "a" ? x.countA : x.countB} /{" "}
        {((which === "a" ? x.rateA : x.rateB) * 100).toFixed(2)}%
      </span>
    </li>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Характерное для «{labelA}»
        </h3>
        {topA.length === 0 ? (
          <p className="text-sm text-slate-500">Нет выраженных лемм.</p>
        ) : (
          <ul>{topA.map((x) => renderRow(x, "a"))}</ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-slate-700">
          Характерное для «{labelB}»
        </h3>
        {topB.length === 0 ? (
          <p className="text-sm text-slate-500">Нет выраженных лемм.</p>
        ) : (
          <ul>{topB.map((x) => renderRow(x, "b"))}</ul>
        )}
      </div>
    </div>
  );
}
