// src/pages/ComparePage.tsx
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AggregateAnalysis from "../components/AggregateAnalysis";
import CompareCharts from "../components/CompareCharts";
import CompareTable from "../components/CompareTable";
import LemmaScoreTable from "../components/LemmaScoreTable";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { useQueryParams } from "../hooks/useQueryParams";
import { aggregateAnalyses } from "../lib/aggregate";
import {
  mergeDistributions,
  normalizeToPercent,
  scoreLemmas,
  uniqueLemmas,
} from "../lib/compare";
import { downloadCsv } from "../lib/csv";
import { fmt1 } from "../lib/format";
import { computeStats } from "../lib/stats";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";
import type { Poem } from "../types";

export default function ComparePage() {
  const navigate = useNavigate();
  const poems = usePoemsStore((s) => s.poems);
  const stopwords = usePoemsStore((s) => s.stopwords);
  const analyses = useAnalysisStore((s) => s.analyses);

  const { getParam, setParam } = useQueryParams();
  const mode = getParam("mode", "abs") as "abs" | "rel";

  const {
    a: poemsA,
    b: poemsB,
    keyA: activeA,
    keyB,
    labelA,
    labelB,
    overlapCount,
    isSubset,
    identical,
    includeOverlap,
    setIncludeOverlap,
    aForCompare,
    bForCompare,
  } = useGlobalCorpusSelection();

  const activeB = keyB ?? "all";
  const nameB = labelB ?? "B";

  const stopwordsSet = useMemo(() => new Set(stopwords), [stopwords]);

  // Есть ли что сравнивать (обе стороны непусты).
  const comparing =
    poemsB != null &&
    bForCompare != null &&
    bForCompare.length > 0 &&
    aForCompare.length > 0;

  // Если B выбран, но сравнивать нечего — покажем объяснение.
  const nothingToCompare =
    poemsB != null && (!comparing || bForCompare == null);

  const statsA = useMemo(
    () => computeStats(aForCompare, { stopwords: stopwordsSet, topN: 30 }),
    [aForCompare, stopwordsSet],
  );
  const statsB = useMemo(
    () =>
      bForCompare
        ? computeStats(bForCompare, { stopwords: stopwordsSet, topN: 30 })
        : null,
    [bForCompare, stopwordsSet],
  );

  const aggA = useMemo(
    () =>
      aggregateAnalyses(aForCompare, analyses, {
        stopwords: stopwordsSet,
        topN: 30,
      }),
    [aForCompare, analyses, stopwordsSet],
  );
  const aggB = useMemo(
    () =>
      bForCompare
        ? aggregateAnalyses(bForCompare, analyses, {
            stopwords: stopwordsSet,
            topN: 30,
          })
        : null,
    [bForCompare, analyses, stopwordsSet],
  );

  // Список для анализа = объединение ОРИГИНАЛЬНЫХ A и B (без вычитаний),
  // чтобы анализы уже были готовы к моменту сравнения.
  const analyzePoems = useMemo(() => {
    if (!poemsB) return poemsA;
    const idsA = new Set(poemsA.map((p: Poem) => p.id));
    return [...poemsA, ...poemsB.filter((p) => !idsA.has(p.id))];
  }, [poemsA, poemsB]);
  void analyzePoems;

  const applyMode = useCallback(
    (data: { name: string; a: number; b: number }[]) =>
      mode === "rel" ? normalizeToPercent(data) : data,
    [mode],
  );

  const meterData = useMemo(
    () =>
      aggB ? applyMode(mergeDistributions(aggA.meterDist, aggB.meterDist)) : [],
    [aggA.meterDist, aggB, applyMode],
  );
  const posData = useMemo(
    () =>
      aggB ? applyMode(mergeDistributions(aggA.posDist, aggB.posDist)) : [],
    [aggA.posDist, aggB, applyMode],
  );
  const lemmaData = useMemo(
    () =>
      aggB
        ? applyMode(
            mergeDistributions(aggA.allLemmas, aggB.allLemmas).slice(0, 30),
          )
        : [],
    [aggA.allLemmas, aggB, applyMode],
  );

  const uniq = useMemo(
    () =>
      aggB
        ? uniqueLemmas(aggA.allLemmas, aggB.allLemmas)
        : { onlyA: [], onlyB: [] },
    [aggA.allLemmas, aggB],
  );

  const lemmaScores = useMemo(
    () => (aggB ? scoreLemmas(aggA.allLemmas, aggB.allLemmas) : []),
    [aggA.allLemmas, aggB],
  );

  const handleLemmaClick = (lemma: string) => {
    navigate(`/lemma/${encodeURIComponent(lemma)}`);
  };

  const handleExport = () => {
    if (!statsB || !aggB) return;
    const rows: (string | number)[][] = [];

    rows.push(["Сравнение групп", labelA, nameB]);
    if (overlapCount > 0) {
      rows.push([
        "Примечание",
        identical
          ? "Группы идентичны"
          : includeOverlap
            ? `Пересечение ${overlapCount} стихов включено в обе группы`
            : isSubset
              ? `Одна группа входит в другую (${overlapCount} общих исключены из большей)`
              : `Пересечение ${overlapCount} стихов исключено из обеих групп`,
      ]);
    }
    rows.push([]);

    rows.push(["Общие метрики"]);
    rows.push(["Метрика", labelA, nameB, "Delta"]);
    rows.push([
      "Стихотворений",
      statsA.poemCount,
      statsB.poemCount,
      statsA.poemCount - statsB.poemCount,
    ]);
    rows.push([
      "Строк",
      statsA.totalLines,
      statsB.totalLines,
      statsA.totalLines - statsB.totalLines,
    ]);
    rows.push([
      "Слов",
      statsA.totalWords,
      statsB.totalWords,
      statsA.totalWords - statsB.totalWords,
    ]);
    rows.push([
      "Среднее строк в стих.",
      statsA.linesPerPoem.mean.toFixed(2),
      statsB.linesPerPoem.mean.toFixed(2),
      (statsA.linesPerPoem.mean - statsB.linesPerPoem.mean).toFixed(2),
    ]);
    rows.push([
      "Медиана строк в стих.",
      statsA.linesPerPoem.median.toFixed(2),
      statsB.linesPerPoem.median.toFixed(2),
      (statsA.linesPerPoem.median - statsB.linesPerPoem.median).toFixed(2),
    ]);
    rows.push([
      "Среднее слов в строке",
      statsA.wordsPerLine.mean.toFixed(2),
      statsB.wordsPerLine.mean.toFixed(2),
      (statsA.wordsPerLine.mean - statsB.wordsPerLine.mean).toFixed(2),
    ]);
    rows.push([
      "Проанализировано стихов",
      aggA.analyzedCount,
      aggB.analyzedCount,
      aggA.analyzedCount - aggB.analyzedCount,
    ]);
    rows.push([]);

    rows.push(["Распределение размеров"]);
    rows.push(["Размер", labelA, nameB]);
    for (const m of mergeDistributions(aggA.meterDist, aggB.meterDist)) {
      rows.push([m.name, m.a, m.b]);
    }
    rows.push([]);

    rows.push(["Части речи"]);
    rows.push(["Часть речи", labelA, nameB]);
    for (const p of mergeDistributions(aggA.posDist, aggB.posDist)) {
      rows.push([p.name, p.a, p.b]);
    }
    rows.push([]);

    rows.push(["Леммы (log-odds)"]);
    rows.push([
      "Лемма",
      `${labelA} (частота)`,
      `${labelA} (%)`,
      `${nameB} (частота)`,
      `${nameB} (%)`,
      "log-odds",
    ]);
    const sortedScores = [...lemmaScores].sort(
      (x, y) => Math.abs(y.logOdds) - Math.abs(x.logOdds),
    );
    for (const s of sortedScores) {
      rows.push([
        s.name,
        s.countA,
        (s.rateA * 100).toFixed(3),
        s.countB,
        (s.rateB * 100).toFixed(3),
        s.logOdds.toFixed(4),
      ]);
    }

    const filename = `compare-${activeA}-vs-${activeB}.csv`;
    downloadCsv(filename, rows);
  };

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  if (!poemsB) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Сравнение групп</h1>
          <p className="mt-1 text-slate-600">
            Метрики и лингвистические характеристики двух мини-корпусов.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Выберите корпус B в шапке страницы (список «Сравнить с…»), чтобы
          сравнить его с корпусом A.
        </div>
      </div>
    );
  }

  const hasAnalysis = aggA.analyzedCount > 0 || (aggB?.analyzedCount ?? 0) > 0;

  const kpiRows =
    comparing && statsB
      ? [
          {
            label: "Стихотворений",
            a: statsA.poemCount,
            b: statsB.poemCount,
            delta: statsA.poemCount - statsB.poemCount,
          },
          {
            label: "Строк",
            a: statsA.totalLines,
            b: statsB.totalLines,
            delta: statsA.totalLines - statsB.totalLines,
          },
          {
            label: "Слов",
            a: statsA.totalWords,
            b: statsB.totalWords,
            delta: statsA.totalWords - statsB.totalWords,
          },
          {
            label: "Среднее строк в стих.",
            a: fmt1(statsA.linesPerPoem.mean),
            b: fmt1(statsB.linesPerPoem.mean),
            delta: statsA.linesPerPoem.mean - statsB.linesPerPoem.mean,
          },
          {
            label: "Медиана строк в стих.",
            a: fmt1(statsA.linesPerPoem.median),
            b: fmt1(statsB.linesPerPoem.median),
            delta: statsA.linesPerPoem.median - statsB.linesPerPoem.median,
          },
          {
            label: "Среднее слов в строке",
            a: fmt1(statsA.wordsPerLine.mean),
            b: fmt1(statsB.wordsPerLine.mean),
            delta: statsA.wordsPerLine.mean - statsB.wordsPerLine.mean,
          },
          {
            label: "Проанализировано стихов",
            a: aggA.analyzedCount,
            b: aggB?.analyzedCount ?? 0,
            delta: aggA.analyzedCount - (aggB?.analyzedCount ?? 0),
          },
        ]
      : [];

  const unit = mode === "rel" ? "%" : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Сравнение групп</h1>
          <p className="mt-1 text-slate-600">
            «{labelA}» vs «{nameB}». Корпуса переключаются в шапке страницы.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            <button
              onClick={() => setParam("mode", "abs", "abs")}
              className={
                mode === "abs"
                  ? "bg-slate-900 px-3 py-1.5 text-sm text-white"
                  : "bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
              }
            >
              Абсолютные
            </button>
            <button
              onClick={() => setParam("mode", "rel", "abs")}
              className={
                mode === "rel"
                  ? "bg-slate-900 px-3 py-1.5 text-sm text-white"
                  : "bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
              }
            >
              %
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={!comparing}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Экспорт CSV
          </button>
        </div>
      </div>

      {/* Баннер про пересечение */}
      {overlapCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1">
              {identical ? (
                <>
                  Группы идентичны по составу. Сравнивать нечего — выберите
                  разные группы или отметьте «Не исключать пересечение», чтобы
                  увидеть «всё vs всё».
                </>
              ) : isSubset ? (
                <>
                  Одна группа целиком входит в другую. Общих стихов:{" "}
                  <strong>{overlapCount}</strong>.{" "}
                  {includeOverlap
                    ? "Пересечение включено в обе стороны."
                    : "Из большей группы они исключены."}{" "}
                  {!includeOverlap && comparing && (
                    <>
                      Сравниваются: «{labelA}» ({aForCompare.length}{" "}
                      {plural(aForCompare.length, "стих", "стиха", "стихов")}) и
                      «{nameB}» ({bForCompare?.length ?? 0}{" "}
                      {plural(
                        bForCompare?.length ?? 0,
                        "стих",
                        "стиха",
                        "стихов",
                      )}
                      ).
                    </>
                  )}
                </>
              ) : (
                <>
                  Пересечение: <strong>{overlapCount}</strong>{" "}
                  {plural(overlapCount, "стих", "стиха", "стихов")}.{" "}
                  {includeOverlap
                    ? "Включены в обе группы (частоты завышены — интерпретируйте осторожно)."
                    : "Исключены из обеих сторон для честного сравнения."}
                </>
              )}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={includeOverlap}
                onChange={(e) => setIncludeOverlap(e.target.checked)}
              />
              Не исключать пересечение
            </label>
          </div>
        </div>
      )}

      {nothingToCompare ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {identical
            ? "Группы A и B идентичны. Выберите разные группы или включите пересечение."
            : "После исключения пересечения одна из групп пуста. Включите пересечение или выберите другие группы."}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Общие метрики
            </h2>
            <CompareTable labelA={labelA} labelB={nameB} rows={kpiRows} />
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Распределение размеров
            </h2>
            {meterData.length === 0 ? (
              <p className="text-sm text-slate-500">
                Запустите анализ на странице «Статистика».
              </p>
            ) : (
              <CompareCharts
                data={meterData}
                labelA={labelA}
                labelB={nameB}
                height={280}
                unit={unit}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Части речи
            </h2>
            {posData.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных анализа.</p>
            ) : (
              <CompareCharts
                data={posData}
                labelA={labelA}
                labelB={nameB}
                vertical
                yWidth={150}
                unit={unit}
              />
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Топ-30 лемм в каждой группе
              <span className="ml-2 text-xs text-slate-400">
                клик по столбцу — показать стихи
              </span>
            </h2>
            {lemmaData.length === 0 ? (
              <p className="text-sm text-slate-500">Нет данных анализа.</p>
            ) : (
              <CompareCharts
                data={lemmaData}
                labelA={labelA}
                labelB={nameB}
                vertical
                yWidth={110}
                maxHeight={900}
                unit={unit}
                onBarClick={handleLemmaClick}
              />
            )}
          </div>

          {lemmaScores.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-700">
                Специфичные леммы (log-odds ratio со сглаживанием)
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Слева — леммы, которые непропорционально часто встречаются в «
                {labelA}», справа — в «{nameB}». Частота показана как
                «абсолютное число / доля в группе».
              </p>
              <LemmaScoreTable
                scores={lemmaScores}
                labelA={labelA}
                labelB={nameB}
                topN={20}
                onLemmaClick={handleLemmaClick}
              />
            </div>
          )}

          {(uniq.onlyA.length > 0 || uniq.onlyB.length > 0) && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-slate-700">
                  Только в «{labelA}»
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {uniq.onlyA
                    .slice(0, 20)
                    .map((x) => x.name)
                    .join(", ") || "—"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-medium text-slate-700">
                  Только в «{nameB}»
                </h2>
                <p className="text-sm leading-relaxed text-slate-600">
                  {uniq.onlyB
                    .slice(0, 20)
                    .map((x) => x.name)
                    .join(", ") || "—"}
                </p>
              </div>
            </div>
          )}

          {hasAnalysis && (
            <>
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  Развёрнутый анализ группы A
                </summary>
                <div className="mt-4">
                  <AggregateAnalysis stats={aggA} />
                </div>
              </details>

              {aggB && (
                <details className="rounded-xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">
                    Развёрнутый анализ группы B
                  </summary>
                  <div className="mt-4">
                    <AggregateAnalysis stats={aggB} />
                  </div>
                </details>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
