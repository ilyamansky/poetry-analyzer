// src/pages/TablePage.tsx
import { useMemo } from "react";
import { Link } from "react-router-dom";
import Pagination from "../components/Pagination";
import TableFilters from "../components/TableFilters";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { usePagination } from "../hooks/usePagination";
import { useQueryParams } from "../hooks/useQueryParams";
import { decodeCorpusRef } from "../store/comparisonStore";
import { useAnalysisStore } from "../store/analysisStore";
import { usePoemsStore } from "../store/poemsStore";
import { downloadCsv } from "../lib/csv";
import { fmt1 } from "../lib/format";
import {
  applyFilters,
  buildRows,
  collectMeters,
  sortRows,
  type SortDir,
  type SortKey,
  type TableFilters as Filters,
} from "../lib/table";
import { cn } from "../lib/cn";

const FILTER_URL_KEYS: Record<keyof Filters, string> = {
  meterKey: "meter",
  linesMin: "lines-min",
  linesMax: "lines-max",
  wordsMin: "words-min",
  wordsMax: "words-max",
  query: "q",
  lemma: "lemma",
  posGroup: "pos",
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "index", label: "№" },
  { value: "lines", label: "Строк" },
  { value: "words", label: "Слов" },
  { value: "chars", label: "Знаков" },
  { value: "meter", label: "Размер" },
];

function parseNum(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseFilters(params: URLSearchParams): Filters {
  return {
    meterKey: params.get("meter") ?? "all",
    linesMin: parseNum(params.get("lines-min")),
    linesMax: parseNum(params.get("lines-max")),
    wordsMin: parseNum(params.get("words-min")),
    wordsMax: parseNum(params.get("words-max")),
    query: params.get("q") ?? "",
    lemma: params.get("lemma") ?? "",
    posGroup: params.get("pos") ?? "all",
  };
}

export default function TablePage() {
  const poems = usePoemsStore((s) => s.poems);
  const groups = usePoemsStore((s) => s.groups);
  const analyses = useAnalysisStore((s) => s.analyses);

  const { params, setParam, setParams } = useQueryParams();
  const paramsKey = params.toString();

  const filters = useMemo(
    () => parseFilters(new URLSearchParams(paramsKey)),
    [paramsKey],
  );
  const sortKey = (params.get("sort") ?? "index") as SortKey;
  const sortDir = (params.get("dir") === "desc" ? "desc" : "asc") as SortDir;

  const { a: poemsA, keyA, setA } = useGlobalCorpusSelection();

  const handleCorpusChange = (value: string) => {
    setA(decodeCorpusRef(value));
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    const str = value === null ? "" : String(value);
    const defaultVal = key === "meterKey" || key === "posGroup" ? "all" : "";
    setParam(FILTER_URL_KEYS[key], str, defaultVal, { resetPage: true });
  };

  const resetFilters = () => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of Object.values(FILTER_URL_KEYS)) {
          next.delete(k);
        }
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  };

  const toggleSort = (key: SortKey) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (sortKey === key) {
          if (sortDir === "asc") next.set("dir", "desc");
          else {
            next.delete("sort");
            next.delete("dir");
          }
        } else {
          next.set("sort", key);
          next.delete("dir");
        }
        next.set("page", "1");
        return next;
      },
      { replace: true },
    );
  };

  const rows = useMemo(() => buildRows(poemsA, analyses), [poemsA, analyses]);
  const meters = useMemo(() => collectMeters(rows), [rows]);

  const filtered = useMemo(
    () => applyFilters(rows, filters, analyses),
    [rows, filters, analyses],
  );

  const sorted = useMemo(
    () => sortRows(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  );

  const total = sorted.length;
  const { page, pageSize, setPage, setPageSize } = usePagination({
    total,
    defaultPageSize: 50,
  });
  const start = (page - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const handleExport = () => {
    const header = [
      "№",
      "Строк",
      "Слов",
      "Знаков (без пробелов)",
      "Размер",
      "Доминирующая часть речи",
      "Глаголов на существительное",
      "Проанализирован",
      "Первая строка",
    ];
    const body = sorted.map((r) => [
      r.index,
      r.linesCount,
      r.wordsCount,
      r.charsCount,
      r.meter ?? "",
      r.dominantPos ?? "",
      r.verbNounRatio != null ? fmt1(r.verbNounRatio) : "",
      r.analyzed ? "да" : "нет",
      r.firstLine,
    ]);
    downloadCsv(`poems-table-${Date.now()}.csv`, [header, ...body]);
  };

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold sm:text-2xl">Таблица стихов</h1>
          <p className="mt-1 text-sm text-slate-600">
            Сортировка по клику на заголовок. Фильтры и сортировка — в URL.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Экспорт CSV
        </button>
      </div>

      {/* Селектор корпуса */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0">Показать:</span>
          <select
            aria-label="Какой корпус показать"
            value={keyA}
            onChange={(e) => handleCorpusChange(e.target.value)}
            className="min-w-0 max-w-65 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="all">Весь корпус</option>
            {groups.length > 0 && <option value="none">Без группы</option>}
            {groups.map((g) => (
              <option key={g.id} value={g.id} title={g.name}>
                {g.name} ({g.poemIds.length})
              </option>
            ))}
          </select>
        </label>
      </div>

      <TableFilters
        filters={filters}
        onChange={updateFilter}
        onReset={resetFilters}
        meters={meters}
        total={total}
      />

      {filters.lemma && (
        <Link
          to={`/lemma/${encodeURIComponent(filters.lemma)}`}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          <span>
            Лемма:{" "}
            <span className="font-mono font-medium text-slate-900">
              «{filters.lemma}»
            </span>
          </span>
          <span className="text-slate-500">→ портрет слова</span>
        </Link>
      )}

      {/* Мобильный сортировщик */}
      {total > 0 && (
        <div className="flex items-center gap-2 md:hidden">
          <label className="flex flex-1 items-center gap-2 text-sm text-slate-600">
            <span className="shrink-0">Сортировать:</span>
            <select
              value={sortKey}
              onChange={(e) => {
                const next = e.target.value as SortKey;
                setParams(
                  (prev) => {
                    const np = new URLSearchParams(prev);
                    if (next === "index") {
                      np.delete("sort");
                    } else {
                      np.set("sort", next);
                    }
                    np.set("page", "1");
                    return np;
                  },
                  { replace: true },
                );
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
            onClick={() => {
              setParams(
                (prev) => {
                  const np = new URLSearchParams(prev);
                  const current = np.get("dir") === "desc" ? "desc" : "asc";
                  if (current === "asc") np.set("dir", "desc");
                  else np.delete("dir");
                  np.set("page", "1");
                  return np;
                },
                { replace: true },
              );
            }}
            aria-label={sortDir === "desc" ? "По убыванию" : "По возрастанию"}
            title={sortDir === "desc" ? "По убыванию" : "По возрастанию"}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            {sortDir === "desc" ? "↓" : "↑"}
          </button>
        </div>
      )}

      {total === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Ничего не найдено по текущим фильтрам.
        </div>
      ) : (
        <>
          {/* Мобильный вид: карточки */}
          <ul className="space-y-2 md:hidden">
            {visible.map((r) => (
              <li key={r.poem.id}>
                <Link
                  to={`/poems/${r.poem.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-medium text-slate-900">
                        № {r.index}
                      </span>
                      {r.meter && (
                        <span className="shrink-0 text-xs text-slate-600">
                          {r.meter}
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">
                      {r.analyzed ? "проанализирован" : "без анализа"}
                    </span>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
                    {r.firstLine || (
                      <span className="italic text-slate-400">(пусто)</span>
                    )}
                  </p>
                  <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs text-slate-500">
                    <div className="flex justify-between gap-2">
                      <dt>Строк</dt>
                      <dd className="tabular-nums text-slate-700">
                        {r.linesCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Слов</dt>
                      <dd className="tabular-nums text-slate-700">
                        {r.wordsCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Знаков</dt>
                      <dd className="tabular-nums text-slate-700">
                        {r.charsCount}
                      </dd>
                    </div>
                    {r.dominantPos && (
                      <div className="col-span-2 flex gap-1 truncate">
                        <dt className="shrink-0">Гл. ч.р.:</dt>
                        <dd className="truncate text-slate-700">
                          {r.dominantPos}
                        </dd>
                      </div>
                    )}
                    {r.verbNounRatio != null && (
                      <div className="flex justify-between gap-1">
                        <dt>гл./сущ.</dt>
                        <dd className="tabular-nums text-slate-700">
                          {fmt1(r.verbNounRatio)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Десктопный вид: таблица */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <Th
                    label="№"
                    sortKey="index"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                    className="w-20"
                  />
                  <Th
                    label="Строк"
                    sortKey="lines"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                    className="w-24"
                  />
                  <Th
                    label="Слов"
                    sortKey="words"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                    className="w-24"
                  />
                  <Th
                    label="Знаков"
                    sortKey="chars"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    align="right"
                    className="w-24"
                  />
                  <Th
                    label="Размер"
                    sortKey="meter"
                    currentKey={sortKey}
                    currentDir={sortDir}
                    onSort={toggleSort}
                    className="w-40"
                  />
                  <th className="w-28 px-3 py-2 text-left font-medium">
                    Главная ч.р.
                  </th>
                  <th className="w-20 px-3 py-2 text-right font-medium">
                    гл./сущ.
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    Первая строка
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.poem.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-3 py-2 text-right tabular-nums">
                      <Link
                        to={`/poems/${r.poem.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {r.index}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {r.linesCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {r.wordsCount}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {r.charsCount}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.meter ?? <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {r.dominantPos ?? (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {r.verbNounRatio != null ? (
                        fmt1(r.verbNounRatio)
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/poems/${r.poem.id}`}
                        className="block max-w-md truncate text-slate-600 hover:text-slate-900"
                        title={r.firstLine}
                      >
                        {r.firstLine || (
                          <span className="italic text-slate-400">(пусто)</span>
                        )}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  );
}

function Th({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = currentKey === sortKey;
  const isDefault = sortKey === "index" && currentDir === "asc";
  const arrow = !active || isDefault ? "" : currentDir === "asc" ? "↑" : "↓";

  return (
    <th
      aria-sort={
        active && !isDefault
          ? currentDir === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      className={cn("px-3 py-2 font-medium", className)}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex w-full items-center gap-1 rounded transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          align === "right" ? "justify-end" : "justify-start",
          active && !isDefault && "text-slate-900",
        )}
      >
        <span>{label}</span>
        {arrow && <span className="text-slate-400">{arrow}</span>}
      </button>
    </th>
  );
}
