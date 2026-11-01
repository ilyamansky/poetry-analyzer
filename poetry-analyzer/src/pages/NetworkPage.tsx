// src/pages/NetworkPage.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CooccurrenceNetwork from "../components/CooccurrenceNetwork";
import OverlapBanner from "../components/OverlapBanner";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { useQueryParams } from "../hooks/useQueryParams";
import {
  buildCooccurrenceGraph,
  buildFocusGraph,
  computePairStats,
} from "../lib/cooccurrence";
import {
  communityColor,
  computeNetworkMetrics,
  type NetworkMetrics,
} from "../lib/networkMetrics";
import { cn } from "../lib/cn";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";

const NETWORK_POS_GROUPS = [
  "существительное",
  "глагол",
  "прилагательное",
  "наречие",
  "причастие",
  "деепричастие",
  "числительное",
] as const;

type SizeMode = "freq" | "degree" | "betweenness" | "pagerank";
type ColorMode = "focus" | "community";
type SortKey =
  | "id"
  | "freq"
  | "degree"
  | "betweenness"
  | "pagerank"
  | "community";

const SIZE_LABELS: Record<SizeMode, string> = {
  freq: "Частота",
  degree: "Степень",
  betweenness: "Betweenness",
  pagerank: "PageRank",
};

const COLOR_LABELS: Record<ColorMode, string> = {
  focus: "Фокус",
  community: "Сообщества",
};

export default function NetworkPage() {
  const poems = usePoemsStore((s) => s.poems);
  const stopwords = usePoemsStore((s) => s.stopwords);
  const analyses = useAnalysisStore((s) => s.analyses);
  const navigate = useNavigate();

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

  const graphInputA = canCompare ? aForCompare : poemsA;
  const graphInputB = canCompare ? bForCompare : null;

  const comparing = canCompare;

  const { getParam, setParam } = useQueryParams();
  const topN = Number(getParam("top", "50")) || 50;

  const minWeightParam = getParam("minw", "");
  const defaultMinWeight = 2;
  const parsedMinWeight = Number(minWeightParam);
  const minWeight =
    minWeightParam === ""
      ? defaultMinWeight
      : Number.isFinite(parsedMinWeight)
        ? parsedMinWeight
        : defaultMinWeight;

  const posParam = getParam("pos", "");
  const focus = getParam("focus", "").trim().toLowerCase();

  const sizeBy = (getParam("size", "freq") as SizeMode) || "freq";
  const colorBy = (getParam("color", "focus") as ColorMode) || "focus";

  const [focusInput, setFocusInput] = useState(focus);
  const [lastUrlFocus, setLastUrlFocus] = useState(focus);

  // Sync URL → input (back button, внешняя навигация).
  if (focus !== lastUrlFocus) {
    setLastUrlFocus(focus);
    setFocusInput(focus);
  }

  const stopwordsSet = useMemo(() => new Set(stopwords), [stopwords]);
  const posGroups = useMemo(() => {
    const groups = posParam.split(",").filter(Boolean);
    return groups.length > 0 ? new Set(groups) : undefined;
  }, [posParam]);

  const statsA = useMemo(
    () =>
      computePairStats(graphInputA, analyses, {
        stopwords: stopwordsSet,
        posGroups,
      }),
    [graphInputA, analyses, stopwordsSet, posGroups],
  );
  const statsB = useMemo(
    () =>
      graphInputB
        ? computePairStats(graphInputB, analyses, {
            stopwords: stopwordsSet,
            posGroups,
          })
        : null,
    [graphInputB, analyses, stopwordsSet, posGroups],
  );

  const graphA = useMemo(
    () =>
      focus
        ? buildFocusGraph(statsA, focus, {
            topK: topN,
            minWeight,
            weightMode: "count",
          })
        : buildCooccurrenceGraph(statsA, {
            topN,
            minWeight,
            weightMode: "count",
          }),
    [statsA, focus, topN, minWeight],
  );
  const graphB = useMemo(
    () =>
      statsB
        ? focus
          ? buildFocusGraph(statsB, focus, {
              topK: topN,
              minWeight,
              weightMode: "count",
            })
          : buildCooccurrenceGraph(statsB, {
              topN,
              minWeight,
              weightMode: "count",
            })
        : null,
    [statsB, focus, topN, minWeight],
  );

  const metricsA = useMemo(() => computeNetworkMetrics(graphA), [graphA]);
  const metricsB = useMemo(
    () => (graphB ? computeNetworkMetrics(graphB) : null),
    [graphB],
  );

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  const togglePos = (group: string) => {
    const current = new Set(posParam.split(",").filter(Boolean));
    if (current.has(group)) current.delete(group);
    else current.add(group);
    setParam("pos", [...current].join(","), "");
  };

  const applyFocus = () =>
    setParam("focus", focusInput.trim().toLowerCase(), "");
  const clearFocus = () => {
    setFocusInput("");
    setParam("focus", "", "");
  };

  const openLemma = (lemma: string) =>
    navigate(`/lemma/${encodeURIComponent(lemma)}`);

  const renderPanel = (
    label: string | null,
    graph: typeof graphA,
    metrics: NetworkMetrics,
  ) => (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        {comparing && (
          <h2 className="mb-3 text-sm font-medium text-slate-700">{label}</h2>
        )}
        {graph.coverage.analyzed === 0 ? (
          <p className="text-sm text-slate-600">
            Граф строится по леммам и требует анализа корпуса. Запустите
            лемматизацию на странице{" "}
            <Link to="/stats" className="text-slate-900 underline">
              «Статистика»
            </Link>
            .
          </p>
        ) : (
          <>
            <p className="mb-3 text-xs text-slate-500">
              Проанализировано {graph.coverage.analyzed} из{" "}
              {graph.coverage.total} стихов. Клик по узлу — страница леммы, узлы
              можно перетаскивать. Наведите — метрики узла.
            </p>
            <CooccurrenceNetwork
              graph={graph}
              metrics={metrics}
              focusId={focus || undefined}
              sizeBy={sizeBy}
              colorBy={colorBy}
              onNodeClick={openLemma}
            />
            {metrics.communityCount > 0 && colorBy === "community" && (
              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>Сообществ: {metrics.communityCount}.</span>
                {metrics.nodes.length > 0 && (
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Крупнейшие:</span>
                    {Array.from({
                      length: Math.min(metrics.communityCount, 4),
                    }).map((_, i) => {
                      const count = metrics.nodes.filter(
                        (n) => n.community === i,
                      ).length;
                      return (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1"
                        >
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor: communityColor(i),
                            }}
                          />
                          C{i + 1} ({count})
                        </span>
                      );
                    })}
                  </span>
                )}
              </p>
            )}
          </>
        )}
        {graph.coverage.analyzed > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Узлов: {graph.nodes.length}, связей: {graph.edges.length}
          </p>
        )}
      </div>

      {metrics.nodes.length > 0 && (
        <MetricsTable
          metrics={metrics}
          onLemmaClick={openLemma}
          title={
            comparing && label ? `Метрики узлов — ${label}` : "Метрики узлов"
          }
        />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">
          Сеть совместной встречаемости
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Узлы — самые частотные леммы, связь — совместное появление в одном
          стихотворении. Вес связи — число стихов, где пара встретилась.
          {comparing && (
            <span className="ml-1 text-slate-500">
              Сравнение: «{labelA}» vs «{labelB}».
            </span>
          )}
        </p>
      </div>

      <OverlapBanner />

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:gap-3 sm:p-4 md:flex md:flex-wrap md:items-center">
        <label className="flex min-w-0 items-center gap-2 text-slate-600">
          <span className="shrink-0">
            {focus ? "Коллокатов:" : "Лемм в топе:"}
          </span>
          <select
            value={String(topN)}
            onChange={(e) => setParam("top", e.target.value, "50")}
            className="min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-2 text-slate-600">
          <span className="shrink-0">Мин. вес:</span>
          <input
            type="number"
            min={1}
            step={1}
            value={minWeightParam === "" ? defaultMinWeight : minWeightParam}
            onChange={(e) =>
              setParam("minw", e.target.value, String(defaultMinWeight))
            }
            className="w-16 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 md:w-20"
          />
        </label>

        <label className="flex min-w-0 items-center gap-2 text-slate-600">
          <span className="shrink-0">Размер:</span>
          <select
            value={sizeBy}
            onChange={(e) => setParam("size", e.target.value, "freq")}
            className="min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            {(Object.keys(SIZE_LABELS) as SizeMode[]).map((m) => (
              <option key={m} value={m}>
                {SIZE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 items-center gap-2 text-slate-600">
          <span className="shrink-0">Цвет:</span>
          <select
            value={colorBy}
            onChange={(e) => setParam("color", e.target.value, "focus")}
            className="min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
          >
            {(Object.keys(COLOR_LABELS) as ColorMode[]).map((m) => (
              <option key={m} value={m}>
                {COLOR_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex min-w-0 items-center gap-2 md:w-auto md:flex-1 md:min-w-70">
          <input
            type="search"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFocus();
            }}
            placeholder="Фокус-слово (лемма)…"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 outline-none transition focus:border-slate-900"
          />
          <button
            onClick={applyFocus}
            disabled={!focusInput.trim()}
            className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Показать
          </button>
          {focus && (
            <button
              onClick={clearFocus}
              className="shrink-0 text-slate-500 hover:text-slate-900"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Части речи:</span>
        {NETWORK_POS_GROUPS.map((g) => {
          const active = posParam.split(",").includes(g);
          return (
            <button
              key={g}
              onClick={() => togglePos(g)}
              className={cn(
                "rounded-full border px-2 py-1 text-xs transition sm:px-3 sm:text-sm",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
              )}
            >
              {g}
            </button>
          );
        })}
        {posParam && (
          <button
            onClick={() => setParam("pos", "", "")}
            className="text-slate-500 hover:text-slate-900"
          >
            Все
          </button>
        )}
      </div>

      {focus && (
        <p className="text-sm text-slate-600">
          Режим фокус-слова: «<strong>{focus}</strong>» и его топ-{topN}{" "}
          коллокатов по частоте, порог веса ≥ {minWeight}.
          {graphA.coverage.analyzed > 0 && graphA.nodes.length === 0 && (
            <span className="text-red-600">
              {" "}
              Слово не найдено среди лемм корпуса или не проходит фильтры.
            </span>
          )}
        </p>
      )}

      {comparing && graphB && metricsB ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderPanel(labelA, graphA, metricsA)}
          {renderPanel(labelB, graphB, metricsB)}
        </div>
      ) : (
        renderPanel(null, graphA, metricsA)
      )}
    </div>
  );
}

// ─── Standalone компоненты (вне NetworkPage, чтобы не создавать в рендере) ───

interface SortHeaderProps {
  k: SortKey;
  label: string;
  align?: "left" | "right";
  sortBy: SortKey;
  desc: boolean;
  onSort: (k: SortKey) => void;
}

function SortHeader({
  k,
  label,
  align = "left",
  sortBy,
  desc,
  onSort,
}: SortHeaderProps) {
  const active = sortBy === k;
  return (
    <th
      aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
      className={cn(
        "cursor-pointer select-none px-2 py-1.5 text-xs uppercase tracking-wide text-slate-500 hover:text-slate-900",
        align === "right" ? "text-right" : "text-left",
      )}
      onClick={() => onSort(k)}
    >
      {label}
      {active && <span className="ml-1">{desc ? "↓" : "↑"}</span>}
    </th>
  );
}

interface MetricsTableProps {
  metrics: NetworkMetrics;
  onLemmaClick: (id: string) => void;
  title: string;
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "degree", label: "Степень" },
  { value: "betweenness", label: "Betweenness" },
  { value: "pagerank", label: "PageRank" },
  { value: "freq", label: "Частота" },
  { value: "id", label: "Лемма (алфавит)" },
  { value: "community", label: "Сообщество" },
];

function MetricsTable({ metrics, onLemmaClick, title }: MetricsTableProps) {
  const [sortBy, setSortBy] = useState<SortKey>("degree");
  const [desc, setDesc] = useState(true);

  const sorted = useMemo(() => {
    const arr = [...metrics.nodes];
    arr.sort((a, b) => {
      const cmp =
        sortBy === "id"
          ? a.id.localeCompare(b.id)
          : sortBy === "community"
            ? a.community - b.community
            : (a[sortBy] as number) - (b[sortBy] as number);
      return desc ? -cmp : cmp;
    });
    return arr;
  }, [metrics.nodes, sortBy, desc]);

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) setDesc((d) => !d);
    else {
      setSortBy(key);
      setDesc(key !== "id");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-700">{title}</h2>
      <p className="mb-3 text-xs text-slate-500">
        <strong>Степень</strong> — сколько связей у слова.{" "}
        <strong>Betweenness</strong> — насколько слово связывает разные
        кластеры. <strong>PageRank</strong> — важность с учётом важности
        соседей. <strong>Сообщество</strong> — автоматическая группировка
        (Louvain).
      </p>

      {/* Мобильный сортировщик */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0">Сортировать:</span>
          <select
            value={sortBy}
            onChange={(e) => {
              const next = e.target.value as SortKey;
              setSortBy(next);
              setDesc(next !== "id");
            }}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setDesc((d) => !d)}
          aria-label={desc ? "По убыванию" : "По возрастанию"}
          title={desc ? "По убыванию" : "По возрастанию"}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          {desc ? "↓" : "↑"}
        </button>
      </div>

      {/* Мобильные карточки */}
      <ul className="space-y-2 md:hidden">
        {sorted.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onLemmaClick(n.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-medium text-slate-800">
                  {n.id}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: communityColor(n.community) }}
                  />
                  C{n.community + 1}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-500">
                <div className="flex justify-between gap-2">
                  <dt>Частота</dt>
                  <dd className="tabular-nums text-slate-700">{n.freq}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Степень</dt>
                  <dd className="tabular-nums text-slate-700">{n.degree}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>Between.</dt>
                  <dd className="tabular-nums text-slate-700">
                    {n.betweenness.toFixed(3)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>PageRank</dt>
                  <dd className="tabular-nums text-slate-700">
                    {n.pagerank.toFixed(4)}
                  </dd>
                </div>
              </dl>
            </button>
          </li>
        ))}
      </ul>

      {/* Десктопная таблица */}
      <div className="hidden max-h-105 overflow-x-auto overflow-y-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50">
            <tr>
              <SortHeader
                k="id"
                label="Лемма"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
              <SortHeader
                k="freq"
                label="Частота"
                align="right"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
              <SortHeader
                k="degree"
                label="Степень"
                align="right"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
              <SortHeader
                k="betweenness"
                label="Betweenness"
                align="right"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
              <SortHeader
                k="pagerank"
                label="PageRank"
                align="right"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
              <SortHeader
                k="community"
                label="Сообщество"
                sortBy={sortBy}
                desc={desc}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((n) => (
              <tr
                key={n.id}
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => onLemmaClick(n.id)}
              >
                <td className="px-2 py-1.5 font-medium text-slate-800">
                  {n.id}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                  {n.freq}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                  {n.degree}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                  {n.betweenness.toFixed(3)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                  {n.pagerank.toFixed(4)}
                </td>
                <td className="px-2 py-1.5 text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: communityColor(n.community) }}
                    />
                    C{n.community + 1}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
