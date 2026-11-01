// src/pages/DispersionPage.tsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import OverlapBanner from "../components/OverlapBanner";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { useQueryParams } from "../hooks/useQueryParams";
import { tokenizeWords } from "../lib/tokenize";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";
import type { PoemAnalysis } from "../lib/api";
import type { Poem } from "../types";

const TERM_COLORS = ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00"];
const MAX_TERMS = 5;

interface TermOccurrence {
  poemIndex: number;
  poemId: string;
  poemTitle: string;
  count: number;
}

interface TermGroupStats {
  freq: number;
  poemCount: number;
  totalPoems: number;
  coverage: number;
  dp: number;
  occurrences: TermOccurrence[];
}

interface TermStats {
  term: string;
  a: TermGroupStats;
  b: TermGroupStats | null;
}

function computeGroupStats(
  occurrences: TermOccurrence[],
  totalPoems: number,
): TermGroupStats {
  const freq = occurrences.reduce((s, o) => s + o.count, 0);
  const poemCount = occurrences.length;

  if (totalPoems === 0 || freq === 0) {
    return {
      freq: 0,
      poemCount: 0,
      totalPoems,
      coverage: 0,
      dp: 0,
      occurrences,
    };
  }
  if (totalPoems === 1) {
    return {
      freq,
      poemCount,
      totalPoems,
      coverage: poemCount,
      dp: 0,
      occurrences,
    };
  }

  let sum = 0;
  for (const o of occurrences) {
    sum += Math.abs(o.count / freq - 1 / totalPoems);
  }
  sum += (totalPoems - poemCount) * (1 / totalPoems);

  return {
    freq,
    poemCount,
    totalPoems,
    coverage: poemCount / totalPoems,
    dp: 0.5 * sum,
    occurrences,
  };
}

function collectOccurrences(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  terms: string[],
): Map<string, TermOccurrence[]> {
  const result = new Map<string, TermOccurrence[]>();
  for (const t of terms) result.set(t, []);

  for (const poem of poems) {
    const a = analyses[poem.id];
    const counts = new Map<string, number>();
    const words = tokenizeWords(poem.content);
    for (const w of words) {
      if (terms.includes(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    if (a) {
      for (const t of a.tokens) {
        const lower = t.original.toLowerCase();
        if (t.lemma !== lower && terms.includes(t.lemma)) {
          counts.set(t.lemma, (counts.get(t.lemma) ?? 0) + 1);
        }
      }
    }
    for (const [term, count] of counts) {
      if (count === 0) continue;
      result.get(term)!.push({
        poemIndex: poem.index,
        poemId: poem.id,
        poemTitle: "",
        count,
      });
    }
  }

  return result;
}

function dpColor(dp: number): string {
  if (dp < 0.3) return "text-emerald-700";
  if (dp < 0.6) return "text-amber-700";
  return "text-red-700";
}

function coverageLabel(
  coverage: number,
  poemCount: number,
  totalPoems: number,
): string {
  if (totalPoems === 0) return "—";
  const pct = Math.round(coverage * 100);
  return `${pct}% (${poemCount}/${totalPoems})`;
}

const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

export default function DispersionPage() {
  const poems = usePoemsStore((s) => s.poems);
  const analyses = useAnalysisStore((s) => s.analyses);
  const navigate = useNavigate();
  const { getParam, setParam } = useQueryParams();
  const termsParam = getParam("terms", "");
  const terms = useMemo(
    () =>
      termsParam
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, MAX_TERMS),
    [termsParam],
  );
  const [input, setInput] = useState(termsParam);

  const {
    a: poemsA,
    b: poemsB,
    labelA,
    labelB,
    aForCompare,
    bForCompare,
  } = useGlobalCorpusSelection();

  const canCompare =
    poemsB != null &&
    bForCompare != null &&
    bForCompare.length > 0 &&
    aForCompare.length > 0;

  const inputA = canCompare ? aForCompare : poemsA;
  const inputB = canCompare ? bForCompare : null;
  const comparing = canCompare;

  const stats: TermStats[] = useMemo(() => {
    const occA = collectOccurrences(inputA, analyses, terms);
    const occB = inputB ? collectOccurrences(inputB, analyses, terms) : null;

    return terms.map((term) => ({
      term,
      a: computeGroupStats(occA.get(term) ?? [], inputA.length),
      b: occB ? computeGroupStats(occB.get(term) ?? [], inputB!.length) : null,
    }));
  }, [terms, inputA, inputB, analyses]);

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  const applyTerms = () =>
    setParam(
      "terms",
      input
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, MAX_TERMS)
        .join(","),
      "",
    );

  const openLemma = (term: string) =>
    navigate(`/lemma/${encodeURIComponent(term)}`);

  const LEFT = 120;
  const RIGHT = 24;
  const TOP = 12;
  const ROW_H = 22;
  const TERM_GAP = 10;
  const AXIS_H = 30;
  const W = 900;

  const rowsPerTerm = comparing ? 2 : 1;
  const blockH = rowsPerTerm * ROW_H + TERM_GAP;
  const plotH = stats.length * blockH - TERM_GAP;
  const H = TOP + plotH + AXIS_H;

  const plotLeft = LEFT;
  const plotRight = W - RIGHT;
  const plotWidth = plotRight - plotLeft;

  const allIndices = [
    ...inputA.map((p) => p.index),
    ...(inputB?.map((p) => p.index) ?? []),
  ];
  const xMin = allIndices.length > 0 ? Math.min(...allIndices) : 1;
  const xMax = allIndices.length > 0 ? Math.max(...allIndices) : 1;
  const xRange = Math.max(1, xMax - xMin);
  const toX = (idx: number) => plotLeft + ((idx - xMin) / xRange) * plotWidth;

  const rawStep = xRange / 8;
  const tickStep =
    NICE_STEPS.find((s) => s >= rawStep) ?? NICE_STEPS[NICE_STEPS.length - 1];
  const ticks: number[] = [];
  for (let v = xMin; v <= xMax; v += tickStep) ticks.push(v);
  if (ticks.length === 0 || ticks[ticks.length - 1] !== xMax) ticks.push(xMax);
  const axisY = TOP + plotH + 14;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          Распределение термов
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Где в корпусе встречается каждый терм: <strong>покрытие</strong> —
          доля стихов, в которых он есть, и <strong>DP</strong> (Gries 2008) —
          насколько неравномерно он распределён между стихами. Высокий DP — терм
          живёт в немногих стихах, низкий — сквозной.
          {comparing && (
            <span className="ml-1 text-slate-500">
              Сравнение: «{labelA}» и «{labelB}».
            </span>
          )}
        </p>
      </div>

      <OverlapBanner />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyTerms();
          }}
          placeholder={`До ${MAX_TERMS} термов через запятую: любовь, ночь…`}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900 sm:min-w-64 sm:px-4"
        />
        <button
          onClick={applyTerms}
          disabled={!input.trim()}
          className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Показать
        </button>
      </div>

      {terms.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Введите хотя бы один терм.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Мобильный вид: карточки */}
          <ul className="space-y-2 md:hidden">
            {stats.map((s, i) => {
              const color = TERM_COLORS[i % TERM_COLORS.length];
              return (
                <li
                  key={s.term}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <button
                    type="button"
                    onClick={() => openLemma(s.term)}
                    className="flex items-center gap-2 text-left font-medium hover:underline"
                    style={{ color }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {s.term}
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                    <div className="flex justify-between gap-2">
                      <dt>Частота A</dt>
                      <dd className="tabular-nums text-slate-700">
                        {s.a.freq}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>DP A</dt>
                      <dd
                        className={cn(
                          "tabular-nums font-medium",
                          dpColor(s.a.dp),
                        )}
                      >
                        {s.a.freq > 0 ? s.a.dp.toFixed(2) : "—"}
                      </dd>
                    </div>
                    <div className="col-span-2 flex justify-between gap-2">
                      <dt>Покрытие A</dt>
                      <dd className="tabular-nums text-slate-700">
                        {coverageLabel(
                          s.a.coverage,
                          s.a.poemCount,
                          s.a.totalPoems,
                        )}
                      </dd>
                    </div>
                    {comparing && s.b && (
                      <>
                        <div className="col-span-2 mt-1 border-t border-slate-100 pt-1 text-slate-400">
                          B «{labelB}»
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>Частота B</dt>
                          <dd className="tabular-nums text-slate-700">
                            {s.b.freq}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt>DP B</dt>
                          <dd
                            className={cn(
                              "tabular-nums font-medium",
                              dpColor(s.b.dp),
                            )}
                          >
                            {s.b.freq > 0 ? s.b.dp.toFixed(2) : "—"}
                          </dd>
                        </div>
                        <div className="col-span-2 flex justify-between gap-2">
                          <dt>Покрытие B</dt>
                          <dd className="tabular-nums text-slate-700">
                            {coverageLabel(
                              s.b.coverage,
                              s.b.poemCount,
                              s.b.totalPoems,
                            )}
                          </dd>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Десктопный вид: таблица */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2">Терм</th>
                  <th className="px-4 py-2 text-right">
                    {comparing ? `A «${labelA}»` : "Частота"}
                  </th>
                  <th className="px-4 py-2 text-right">Покрытие</th>
                  <th className="px-4 py-2 text-right">DP</th>
                  {comparing && (
                    <>
                      <th className="px-4 py-2 text-right">B «{labelB}»</th>
                      <th className="px-4 py-2 text-right">Покрытие</th>
                      <th className="px-4 py-2 text-right">DP</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((s, i) => (
                  <tr key={s.term}>
                    <td className="px-4 py-2">
                      <button
                        onClick={() => openLemma(s.term)}
                        className="inline-flex items-center gap-2 font-medium hover:underline"
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              TERM_COLORS[i % TERM_COLORS.length],
                          }}
                        />
                        {s.term}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {s.a.freq}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                      {coverageLabel(
                        s.a.coverage,
                        s.a.poemCount,
                        s.a.totalPoems,
                      )}
                    </td>
                    <td
                      className={`px-4 py-2 text-right tabular-nums font-medium ${dpColor(
                        s.a.dp,
                      )}`}
                    >
                      {s.a.freq > 0 ? s.a.dp.toFixed(2) : "—"}
                    </td>
                    {comparing && s.b && (
                      <>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {s.b.freq}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                          {coverageLabel(
                            s.b.coverage,
                            s.b.poemCount,
                            s.b.totalPoems,
                          )}
                        </td>
                        <td
                          className={`px-4 py-2 text-right tabular-nums font-medium ${dpColor(
                            s.b.dp,
                          )}`}
                        >
                          {s.b.freq > 0 ? s.b.dp.toFixed(2) : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Strip plot — на всех размерах */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <p className="mb-3 text-xs text-slate-500">
              Ось X — порядковый номер стихотворения в корпусе. Каждая точка —
              стих, в котором встречается терм (наведите, чтобы увидеть номер и
              число вхождений).{" "}
              {comparing &&
                "Внутри каждого терма сверху — корпус A (сплошные точки), снизу — B (полупрозрачные)."}
            </p>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full"
              role="img"
              aria-label="Распределение термов по стихам"
            >
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={axisY}
                y2={axisY}
                stroke="#cbd5e1"
              />
              {ticks.map((tick) => {
                const x = toX(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={x}
                      x2={x}
                      y1={axisY}
                      y2={axisY + 4}
                      stroke="#cbd5e1"
                    />
                    <text
                      x={x}
                      y={axisY + 17}
                      textAnchor="middle"
                      fontSize={10}
                      fill="#64748b"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {stats.map((s, i) => {
                const termTop = TOP + i * blockH;
                const color = TERM_COLORS[i % TERM_COLORS.length];
                const groups: Array<{
                  key: "a" | "b";
                  label: string;
                  data: TermGroupStats;
                }> = [{ key: "a", label: comparing ? "A" : "", data: s.a }];
                if (comparing && s.b)
                  groups.push({ key: "b", label: "B", data: s.b });

                return (
                  <g key={s.term}>
                    <text
                      x={LEFT - 14}
                      y={termTop + (rowsPerTerm * ROW_H) / 2 + 4}
                      textAnchor="end"
                      fontSize={12}
                      fontWeight={500}
                      fill={color}
                      style={{ cursor: "pointer" }}
                      onClick={() => openLemma(s.term)}
                    >
                      {s.term}
                    </text>

                    {groups.map((g, r) => {
                      const y = termTop + r * ROW_H + ROW_H / 2;
                      return (
                        <g key={g.key}>
                          {comparing && (
                            <text
                              x={plotLeft - 8}
                              y={y + 3}
                              textAnchor="end"
                              fontSize={9}
                              fill="#94a3b8"
                            >
                              {g.label}
                            </text>
                          )}
                          {g.data.occurrences.map((o) => {
                            const x = toX(o.poemIndex);
                            const tooltip = `${s.term} (${g.label || "—"}) · стих ${o.poemIndex}${o.poemTitle ? ` «${o.poemTitle}»` : ""}: ${o.count}`;
                            return (
                              <circle
                                key={`${g.key}-${o.poemId}`}
                                cx={x}
                                cy={y}
                                r={3.5}
                                fill={color}
                                opacity={g.key === "a" ? 1 : 0.55}
                              >
                                <title>{tooltip}</title>
                              </circle>
                            );
                          })}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

import { cn } from "../lib/cn";
