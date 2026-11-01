// src/pages/ConcordancePage.tsx
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import Collocations from "../components/Collocations";
import ContextCell from "../components/ContextCell";
import Pagination from "../components/Pagination";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { usePagination } from "../hooks/usePagination";
import { useQueryParams } from "../hooks/useQueryParams";
import { cn } from "../lib/cn";
import {
  buildConcordance,
  computeCollocations,
  sortConcordance,
  type ConcordanceHit,
  type ConcordanceMode,
  type ConcordanceSort,
} from "../lib/concordance";
import { downloadCsv } from "../lib/csv";
import { fmt1 } from "../lib/format";
import { POS_GROUPS, isPosGroup, type PosGroup } from "../lib/pos";
import { tokenizeWords } from "../lib/tokenize";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";

const WIDTHS = [30, 50, 80, 120];
const WINDOWS = [3, 5, 8, 10];
const LINE_CONTEXTS = [0, 1, 2] as const;

type CorpusMode = "a" | "b" | "both";
type TaggedHit = ConcordanceHit & { corpus: "A" | "B" };

export default function ConcordancePage() {
  const navigate = useNavigate();
  const poems = usePoemsStore((s) => s.poems);
  const stopwords = usePoemsStore((s) => s.stopwords);
  const analyses = useAnalysisStore((s) => s.analyses);

  const { getParam, setParam } = useQueryParams();
  const query = getParam("q", "");
  const mode = getParam("mode", "lemma") as ConcordanceMode;
  const width = Math.max(20, Number(getParam("width", "50")) || 50);
  const windowSize = Math.max(1, Number(getParam("window", "5")) || 5);
  const lineContext = Math.max(0, Number(getParam("lines", "0")) || 0);
  const sort = getParam("sort", "position") as ConcordanceSort;
  const posParam = getParam("pos", "");

  const {
    a: corpusPoems,
    b: corpusB,
    labelA,
    labelB,
  } = useGlobalCorpusSelection();
  const hasB = corpusB != null && labelB != null;

  // Выбор источника вхождений. При наличии B по умолчанию — "both",
  // но пользователь может переключиться. Без B — "a".
  const corpusModeParam = getParam("corpus", hasB ? "both" : "a");
  const corpusMode: CorpusMode =
    corpusModeParam === "b" && hasB
      ? "b"
      : corpusModeParam === "both" && hasB
        ? "both"
        : "a";

  const posSet = useMemo(
    () => new Set<PosGroup>(posParam.split(",").filter(isPosGroup)),
    [posParam],
  );
  const posActive = posSet.size > 0;

  const setFilterParam = (key: string, value: string, defaultVal: string) =>
    setParam(key, value, defaultVal, { resetPage: true });

  const togglePos = (group: PosGroup) => {
    const next = new Set(posSet);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setFilterParam("pos", [...next].join(","), "");
  };

  const hitsA = useMemo(
    () =>
      corpusMode === "b"
        ? []
        : buildConcordance({
            poems: corpusPoems,
            analyses,
            query,
            mode,
            width,
            window: windowSize,
            lineContext,
            posFilter: posSet,
          }),
    [
      corpusMode,
      corpusPoems,
      analyses,
      query,
      mode,
      width,
      windowSize,
      lineContext,
      posSet,
    ],
  );

  const hitsB = useMemo(
    () =>
      corpusMode === "a" || !corpusB
        ? null
        : buildConcordance({
            poems: corpusB,
            analyses,
            query,
            mode,
            width,
            window: windowSize,
            lineContext,
            posFilter: posSet,
          }),
    [
      corpusMode,
      corpusB,
      analyses,
      query,
      mode,
      width,
      windowSize,
      lineContext,
      posSet,
    ],
  );

  const showCorpusColumn = corpusMode === "both" && hitsB != null;
  const comparing = showCorpusColumn && labelB != null;

  const hits = useMemo<TaggedHit[]>(() => {
    const taggedA = hitsA.map((h) => ({ ...h, corpus: "A" as const }));
    if (!hitsB) return taggedA;
    return [...taggedA, ...hitsB.map((h) => ({ ...h, corpus: "B" as const }))];
  }, [hitsA, hitsB]);

  const sorted = useMemo(() => sortConcordance(hits, sort), [hits, sort]);

  const stopwordsSet = useMemo(() => new Set(stopwords), [stopwords]);

  const excludeLemmas = useMemo(() => {
    const set = new Set<string>();
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return set;
    if (mode === "lemma" || mode === "word") set.add(trimmed);
    return set;
  }, [query, mode]);

  const collocations = useMemo(() => {
    if (mode === "substring") return [];
    if (!query.trim()) return [];
    return computeCollocations(hits, poems, analyses, {
      stopwords: stopwordsSet,
      excludeLemmas,
      minFreq: 2,
    });
  }, [hits, poems, analyses, stopwordsSet, excludeLemmas, mode, query]);

  const wordsA = useMemo(
    () => corpusPoems.reduce((s, p) => s + tokenizeWords(p.content).length, 0),
    [corpusPoems],
  );
  const wordsB = useMemo(
    () =>
      corpusB
        ? corpusB.reduce((s, p) => s + tokenizeWords(p.content).length, 0)
        : 0,
    [corpusB],
  );

  const total = sorted.length;
  const { page, pageSize, setPage, setPageSize } = usePagination({
    total,
    defaultPageSize: 50,
  });
  const start = (page - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const corpusTag = (h: TaggedHit) => (h.corpus === "A" ? labelA : labelB);

  const handleExport = () => {
    const header = [
      ...(comparing ? ["Корпус"] : []),
      "Стих",
      "Строка",
      "Предыдущие",
      "Левый контекст",
      "Ключ",
      "Правый контекст",
      "Следующие",
    ];
    const rows = sorted.map((h) => [
      ...(comparing ? [corpusTag(h) ?? h.corpus] : []),
      h.poemIndex,
      h.lineNumber,
      h.prevLines.join(" | "),
      h.left,
      h.kw,
      h.right,
      h.nextLines.join(" | "),
    ]);
    downloadCsv(`concordance-${Date.now()}.csv`, [header, ...rows]);
  };

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  const contextHighlightMode: "word" | "substring" | "none" =
    mode === "word" ? "word" : mode === "substring" ? "substring" : "none";

  // Сообщение о режиме «только проанализированные»
  const onlyAnalyzed = mode === "lemma" || (posActive && mode !== "substring");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Конкорданс</h1>
          <p className="mt-1 text-sm text-slate-600">
            Все вхождения в контексте (KWIC). Клик по строке открывает
            стихотворение.
          </p>
        </div>
        {total > 0 && (
          <button
            onClick={handleExport}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Экспорт CSV
          </button>
        )}
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Запрос
            <input
              type="search"
              value={query}
              onChange={(e) => setFilterParam("q", e.target.value, "")}
              placeholder={
                mode === "lemma"
                  ? "лемма, например: ночь"
                  : mode === "word"
                    ? "словоформа, например: ночью"
                    : "подстрока или фраза"
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
          </label>

          <div className="flex flex-col gap-1 text-xs text-slate-500">
            Режим поиска
            <div className="inline-flex overflow-hidden rounded-lg border border-slate-300">
              {(
                [
                  ["lemma", "По лемме"],
                  ["word", "По словоформе"],
                  ["substring", "По подстроке"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setFilterParam("mode", value, "lemma")}
                  className={cn(
                    "px-2 py-2 text-xs transition sm:px-3 sm:text-sm",
                    mode === value
                      ? "bg-slate-900 text-white"
                      : "bg-white hover:bg-slate-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Переключатель источника при сравнении */}
          {hasB && (
            <div className="flex flex-col gap-1 text-xs text-slate-500 lg:col-span-2">
              Где искать
              <div className="inline-flex self-start overflow-hidden rounded-lg border border-slate-300">
                {(
                  [
                    ["a", labelA],
                    ["b", labelB!],
                    ["both", "Оба"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() =>
                      setFilterParam("corpus", value, hasB ? "both" : "a")
                    }
                    className={cn(
                      "max-w-35 truncate px-2 py-2 text-xs transition sm:max-w-none sm:px-3 sm:text-sm",
                      corpusMode === value
                        ? "bg-slate-900 text-white"
                        : "bg-white hover:bg-slate-100",
                    )}
                    title={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 text-xs text-slate-500 lg:col-span-2">
            Часть речи {posActive && "(только среди проанализированных)"}
            <div className="flex flex-wrap gap-1.5">
              {POS_GROUPS.map((group) => (
                <button
                  key={group}
                  onClick={() => togglePos(group)}
                  className={cn(
                    "rounded-full border px-2 py-1 text-xs transition sm:px-3 sm:text-sm",
                    posSet.has(group)
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
                  )}
                >
                  {group}
                </button>
              ))}
            </div>
            {posActive && mode === "substring" && (
              <p className="text-slate-400">
                В режиме подстроки фильтр по части речи не применяется.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:col-span-2">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Контекст
              <select
                value={String(width)}
                onChange={(e) => setFilterParam("width", e.target.value, "50")}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-slate-900"
              >
                {WIDTHS.map((w) => (
                  <option key={w} value={w}>
                    {w} симв.
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Строк ±
              <select
                value={String(lineContext)}
                onChange={(e) => setFilterParam("lines", e.target.value, "0")}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-slate-900"
              >
                {LINE_CONTEXTS.map((n) => (
                  <option key={n} value={n}>
                    {n === 0 ? "только строка" : `± ${n}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Окно слов
              <select
                value={String(windowSize)}
                onChange={(e) => setFilterParam("window", e.target.value, "5")}
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-slate-900"
              >
                {WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    ± {w}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Сортировка
              <select
                value={sort}
                onChange={(e) =>
                  setFilterParam("sort", e.target.value, "position")
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-slate-900"
              >
                <option value="position">Позиция</option>
                <option value="left">Левый</option>
                <option value="right">Правый</option>
                <option value="kw">Ключ</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span>
            {!query ? (
              "Введите запрос"
            ) : onlyAnalyzed ? (
              <>
                Найдено вхождений:{" "}
                <strong className="text-slate-900">{total}</strong>{" "}
                <span className="text-slate-400">
                  (только среди проанализированных)
                </span>
              </>
            ) : (
              <>
                Найдено вхождений:{" "}
                <strong className="text-slate-900">{total}</strong>
              </>
            )}
          </span>
          {query && (
            <button
              onClick={() => setFilterParam("q", "", "")}
              className="rounded text-sm transition hover:text-slate-900 focus:outline-none focus-visible:underline"
            >
              Очистить
            </button>
          )}
        </div>
      </div>

      {comparing && query.trim() && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>
            <strong className="text-slate-900">«{labelA}»</strong>:{" "}
            {hitsA.length} вх. ·{" "}
            {wordsA > 0 ? fmt1((hitsA.length / wordsA) * 1000) : "—"} на 1000
            слов
          </span>
          <span>
            <strong className="text-slate-900">«{labelB}»</strong>:{" "}
            {hitsB?.length ?? 0} вх. ·{" "}
            {wordsB > 0 ? fmt1(((hitsB?.length ?? 0) / wordsB) * 1000) : "—"} на
            1000 слов
          </span>
        </div>
      )}

      {total > 0 && mode !== "substring" && query.trim() && (
        <Collocations
          entries={collocations}
          onLemmaClick={(lemma) => {
            const sp = new URLSearchParams();
            sp.set("q", lemma);
            sp.set("mode", "lemma");
            navigate(`/concordance?${sp.toString()}`);
          }}
        />
      )}

      {total > 0 && (
        <>
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {comparing && (
                    <th className="w-12 px-2 py-2 text-left font-medium sm:w-14 sm:px-3">
                      Корпус
                    </th>
                  )}
                  <th className="w-14 px-2 py-2 text-right font-medium sm:w-20 sm:px-3">
                    Стих
                  </th>
                  <th className="hidden w-16 px-3 py-2 text-right font-medium sm:table-cell">
                    Стр.
                  </th>
                  <th className="px-2 py-2 text-right font-medium sm:px-3">
                    Левый
                  </th>
                  <th className="px-2 py-2 text-center font-medium sm:px-3">
                    Ключ
                  </th>
                  <th className="px-2 py-2 text-left font-medium sm:px-3">
                    Правый
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((h, i) => (
                  <tr
                    key={`${h.corpus}-${h.poemId}-${h.lineIndex}-${i}`}
                    onClick={() => navigate(`/poems/${h.poemId}`)}
                    className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    {comparing && (
                      <td className="px-2 py-1.5 align-top sm:px-3">
                        <span
                          title={corpusTag(h) ?? h.corpus}
                          className={cn(
                            "inline-block rounded px-1.5 py-0.5 text-xs font-medium",
                            h.corpus === "A"
                              ? "bg-slate-900 text-white"
                              : "bg-slate-200 text-slate-700",
                          )}
                        >
                          {h.corpus}
                        </span>
                      </td>
                    )}
                    <td className="px-2 py-1.5 align-top text-right tabular-nums sm:px-3">
                      <Link
                        to={`/poems/${h.poemId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {h.poemIndex}
                      </Link>
                    </td>
                    <td className="hidden px-3 py-1.5 align-top text-right tabular-nums text-slate-500 sm:table-cell">
                      {h.lineNumber}
                    </td>
                    <td className="max-w-30 px-2 py-1.5 align-top text-slate-400 sm:max-w-none sm:px-3">
                      <ContextCell
                        prevLines={h.prevLines}
                        main={h.left}
                        nextLines={[]}
                        query={query}
                        mode={contextHighlightMode}
                        align="right"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 align-top text-center sm:px-3">
                      <mark className="rounded bg-yellow-200 px-1 font-medium text-slate-900">
                        {h.kw}
                      </mark>
                    </td>
                    <td className="max-w-30 px-2 py-1.5 align-top text-slate-700 sm:max-w-none sm:px-3">
                      <ContextCell
                        prevLines={[]}
                        main={h.right}
                        nextLines={h.nextLines}
                        query={query}
                        mode={contextHighlightMode}
                        align="left"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}

      {query && total === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {onlyAnalyzed
            ? "Вхождений не найдено. Возможно, анализ ещё не запускался — вернитесь на страницу «Статистика» и нажмите «Проанализировать»."
            : "Вхождений не найдено."}
        </div>
      )}
    </div>
  );
}
