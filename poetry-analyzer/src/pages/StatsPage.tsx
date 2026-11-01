// src/pages/StatsPage.tsx
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import BarChartCard from "../components/charts/BarChartCard";
import CompareCharts from "../components/CompareCharts";
import CompareTable from "../components/CompareTable";
import OverlapBanner from "../components/OverlapBanner";
import AnalysisBanner from "../components/AnalysisBanner";
import { fmt, fmt1 } from "../lib/format";
import { mergeDistributions } from "../lib/compare";
import { computeStats } from "../lib/stats";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { useQueryParams } from "../hooks/useQueryParams";
import { usePoemsStore } from "../store/poemsStore";
import StopwordsEditor from "../components/StopwordsEditor";
import DistributionTable from "../components/DistributionTable";
import AggregateAnalysis from "../components/AggregateAnalysis";
import DiversitySection from "../components/DiversitySection";
import WordCloudSection from "../components/WordCloudSection";
import NgramsSection from "../components/NgramsSection";
import { aggregateAnalyses } from "../lib/aggregate";
import { useAnalysisStore } from "../store/analysisStore";

export default function StatsPage() {
  const poems = usePoemsStore((s) => s.poems);
  const { getParam, setParam } = useQueryParams();
  const topParam = getParam("top", "30");
  const topN =
    topParam === "all"
      ? Number.POSITIVE_INFINITY
      : Math.max(1, Number(topParam) || 30);
  const navigate = useNavigate();

  const stopwords = usePoemsStore((s) => s.stopwords);
  const stopwordsSet = useMemo(() => new Set(stopwords), [stopwords]);

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

  const statsInput = canCompare ? aForCompare : poemsA;
  const statsBInput = canCompare ? bForCompare : null;

  const stats = useMemo(
    () => computeStats(statsInput, { stopwords: stopwordsSet, topN: 30 }),
    [statsInput, stopwordsSet],
  );
  const statsB = useMemo(
    () =>
      statsBInput
        ? computeStats(statsBInput, { stopwords: stopwordsSet, topN: 30 })
        : null,
    [statsBInput, stopwordsSet],
  );

  const analyses = useAnalysisStore((s) => s.analyses);

  const aggregated = useMemo(
    () =>
      aggregateAnalyses(statsInput, analyses, {
        stopwords: stopwordsSet,
        topN,
      }),
    [statsInput, analyses, stopwordsSet, topN],
  );
  const aggregatedB = useMemo(
    () =>
      statsBInput
        ? aggregateAnalyses(statsBInput, analyses, {
            stopwords: stopwordsSet,
            topN,
          })
        : null,
    [statsBInput, analyses, stopwordsSet, topN],
  );

  const comparing = canCompare;

  const lineLenData = useMemo(() => {
    if (!statsB) return null;
    return stats.lineLengthDist.map((x, i) => ({
      name: x.range,
      a: x.count,
      b: statsB.lineLengthDist[i]?.count ?? 0,
    }));
  }, [stats, statsB]);

  const poemLenData = useMemo(() => {
    if (!statsB) return null;
    return stats.poemLengthDist.map((x, i) => ({
      name: x.range,
      a: x.count,
      b: statsB.poemLengthDist[i]?.count ?? 0,
    }));
  }, [stats, statsB]);

  const topWordsData = useMemo(() => {
    if (!statsB) return null;
    return mergeDistributions(
      stats.topWords.map((w) => ({ name: w.word, count: w.count })),
      statsB.topWords.map((w) => ({ name: w.word, count: w.count })),
    ).slice(0, 30);
  }, [stats, statsB]);

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  const kpiRows =
    comparing && statsB
      ? [
          {
            label: "Стихотворений",
            a: stats.poemCount,
            b: statsB.poemCount,
            delta: stats.poemCount - statsB.poemCount,
          },
          {
            label: "Строк",
            a: stats.totalLines,
            b: statsB.totalLines,
            delta: stats.totalLines - statsB.totalLines,
          },
          {
            label: "Слов",
            a: stats.totalWords,
            b: statsB.totalWords,
            delta: stats.totalWords - statsB.totalWords,
          },
          {
            label: "Средняя длина, стр.",
            a: fmt1(stats.linesPerPoem.mean),
            b: fmt1(statsB.linesPerPoem.mean),
            delta: stats.linesPerPoem.mean - statsB.linesPerPoem.mean,
          },
          {
            label: "Слов в стихотворении",
            a: fmt1(stats.wordsPerPoem.mean),
            b: fmt1(statsB.wordsPerPoem.mean),
            delta: stats.wordsPerPoem.mean - statsB.wordsPerPoem.mean,
          },
          {
            label: "Слов в строке",
            a: fmt1(stats.wordsPerLine.mean),
            b: fmt1(statsB.wordsPerLine.mean),
            delta: stats.wordsPerLine.mean - statsB.wordsPerLine.mean,
          },
        ]
      : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">Статистика</h1>
        <span className="text-sm text-slate-500">
          {comparing ? `«${labelA}» vs «${labelB}»` : labelA}
        </span>
      </div>

      <OverlapBanner />
      <AnalysisBanner />

      {stats.poemCount === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          В выбранном корпусе нет стихов.
        </div>
      ) : (
        <>
          {comparing && statsB ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-700">
                Общие метрики
              </h2>
              <CompareTable
                labelA={labelA}
                labelB={labelB ?? "B"}
                rows={kpiRows}
              />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Стихотворений" value={fmt(stats.poemCount)} />
              <Kpi label="Строк" value={fmt(stats.totalLines)} />
              <Kpi label="Слов" value={fmt(stats.totalWords)} />
              <Kpi
                label="Средняя длина"
                value={`${fmt1(stats.linesPerPoem.mean)} стр.`}
              />
              <Kpi
                label="Слов в стихотворении"
                value={fmt1(stats.wordsPerPoem.mean)}
              />
              <Kpi
                label="Слов в строке"
                value={fmt1(stats.wordsPerLine.mean)}
              />
              <Kpi
                label="Длина в строках"
                value={`${stats.linesPerPoem.min} – ${stats.linesPerPoem.max}`}
              />
            </div>
          )}

          <DiversitySection
            poemsA={statsInput}
            poemsB={statsBInput}
            labelA={labelA}
            labelB={comparing ? labelB : null}
          />

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Распределения: где среднее врёт
              {comparing && (
                <span className="ml-2 text-xs text-slate-400">
                  корпус «{labelA}»
                </span>
              )}
            </h2>
            <DistributionTable
              rows={[
                { label: "Строк в стихотворении", dist: stats.linesPerPoem },
                { label: "Слов в стихотворении", dist: stats.wordsPerPoem },
                { label: "Слов в строке", dist: stats.wordsPerLine },
              ]}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {comparing && lineLenData && poemLenData && labelB ? (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-medium text-slate-700">
                    Распределение длины строк (в словах)
                  </h2>
                  <CompareCharts
                    data={lineLenData}
                    labelA={labelA}
                    labelB={labelB}
                    height={260}
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="mb-3 text-sm font-medium text-slate-700">
                    Распределение длины стихотворений (в словах)
                  </h2>
                  <CompareCharts
                    data={poemLenData}
                    labelA={labelA}
                    labelB={labelB}
                    height={260}
                  />
                </div>
              </>
            ) : (
              <>
                <BarChartCard
                  title="Распределение длины строк (в словах)"
                  data={stats.lineLengthDist}
                  nameKey="range"
                />
                <BarChartCard
                  title="Распределение длины стихотворений (в словах)"
                  data={stats.poemLengthDist}
                  nameKey="range"
                />
              </>
            )}
          </div>

          {comparing && topWordsData && labelB ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-medium text-slate-700">
                Топ-30 слов (без стоп-слов)
              </h2>
              <CompareCharts
                data={topWordsData}
                labelA={labelA}
                labelB={labelB}
                vertical
                yWidth={110}
                height={320}
                maxHeight={900}
              />
            </div>
          ) : (
            <BarChartCard
              title={`Топ-${stats.topWords.length} слов (без стоп-слов)`}
              data={stats.topWords}
              nameKey="word"
              vertical
              height={320}
            />
          )}

          <WordCloudSection
            poemsA={statsInput}
            poemsB={statsBInput}
            labelA={labelA}
            labelB={comparing ? labelB : null}
            stopwords={stopwordsSet}
            analyses={analyses}
          />

          <NgramsSection
            poemsA={statsInput}
            poemsB={statsBInput}
            labelA={labelA}
            labelB={comparing ? labelB : null}
            stopwords={stopwordsSet}
          />

          <StopwordsEditor />

          <section className="space-y-4 pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 pt-6">
              <div>
                <h2 className="text-lg font-semibold">
                  Лингвистический анализ
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Лемматизация и определение размера через RPST. Запускается
                  один раз — результаты кэшируются в браузере.
                </p>
              </div>
              {aggregated.analyzedCount > 0 && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Лемм в топе:
                  <select
                    value={topParam}
                    onChange={(e) => setParam("top", e.target.value, "30")}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
                  >
                    <option value="10">10</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="all">Все</option>
                  </select>
                </label>
              )}
            </div>

            <AggregateAnalysis
              stats={aggregated}
              statsB={aggregatedB}
              labelA={labelA}
              labelB={labelB ?? "B"}
              onLemmaClick={(lemma) =>
                navigate(`/lemma/${encodeURIComponent(lemma)}`)
              }
              onPosClick={(group) =>
                navigate(`/poems?pos=${encodeURIComponent(group)}&pos-min=1`)
              }
            />
          </section>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
