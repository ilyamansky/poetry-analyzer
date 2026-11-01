import type { AggregateStats } from "../lib/aggregate";
import { mergeDistributions, normalizeToPercent } from "../lib/compare";
import BarChartCard from "./charts/BarChartCard";
import CompareCharts from "./CompareCharts";

interface Props {
  stats: AggregateStats;
  statsB?: AggregateStats | null;
  labelA?: string;
  labelB?: string;
  onLemmaClick?: (lemma: string) => void;
  onPosClick?: (group: string) => void;
}

export default function AggregateAnalysis({
  stats,
  statsB,
  labelA = "A",
  labelB = "B",
  onLemmaClick,
  onPosClick,
}: Props) {
  const { analyzedCount, totalCount, meterDist, posDist, topLemmas } = stats;

  if (analyzedCount === 0) return null;

  const interactive = typeof onLemmaClick === "function";
  const posInteractive = typeof onPosClick === "function";
  const grouped = statsB != null && statsB.analyzedCount > 0;

  const posTitle = (
    <>
      Части речи
      {posInteractive && (
        <span className="ml-2 text-xs text-slate-400">
          клик по столбцу — показать стихи
        </span>
      )}
    </>
  );

  if (grouped && statsB) {
    const meterData = normalizeToPercent(
      mergeDistributions(meterDist, statsB.meterDist),
    );
    const posData = normalizeToPercent(
      mergeDistributions(posDist, statsB.posDist),
    );
    const lemmaData = normalizeToPercent(
      mergeDistributions(stats.allLemmas, statsB.allLemmas).slice(0, 30),
    );

    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Проанализировано: «{labelA}» — <strong>{analyzedCount}</strong> из{" "}
          {totalCount}, «{labelB}» — <strong>{statsB.analyzedCount}</strong> из{" "}
          {statsB.totalCount} стихов. Значения — доли в процентах.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              Распределение размеров
            </h2>
            <CompareCharts
              data={meterData}
              labelA={labelA}
              labelB={labelB}
              height={280}
              unit="%"
            />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-medium text-slate-700">
              {posTitle}
            </h2>
            <CompareCharts
              data={posData}
              labelA={labelA}
              labelB={labelB}
              vertical
              yWidth={150}
              unit="%"
              onBarClick={posInteractive ? onPosClick : undefined}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">
            Леммы (значимые части речи, без стоп-слов)
            {interactive && (
              <span className="ml-2 text-xs text-slate-400">
                клик по столбцу — показать стихи
              </span>
            )}
          </h2>
          <CompareCharts
            data={lemmaData}
            labelA={labelA}
            labelB={labelB}
            vertical
            yWidth={110}
            maxHeight={900}
            unit="%"
            onBarClick={interactive ? onLemmaClick : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Проанализировано <strong>{analyzedCount}</strong> из {totalCount}{" "}
        стихов.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Распределение размеров"
          data={meterDist}
          nameKey="name"
          xInterval={0}
        />
        <BarChartCard
          title={posTitle}
          data={posDist}
          nameKey="name"
          vertical
          perRow={26}
          yWidth={150}
          onBarClick={posInteractive ? onPosClick : undefined}
        />
      </div>

      <BarChartCard
        title={
          <>
            Леммы (значимые части речи, без стоп-слов)
            {interactive && (
              <span className="ml-2 text-xs text-slate-400">
                клик по столбцу — показать стихи
              </span>
            )}
          </>
        }
        data={topLemmas}
        nameKey="name"
        vertical
        height={320}
        maxHeight={900}
        onBarClick={interactive ? onLemmaClick : undefined}
      />
    </div>
  );
}
