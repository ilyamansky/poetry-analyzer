// src/components/TableFilters.tsx
import { POS_GROUPS } from "../lib/pos";
import type { TableFilters as Filters } from "../lib/table";

interface Props {
  filters: Filters;
  onChange: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  onReset: () => void;
  meters: string[];
  total: number;
}

export default function TableFilters({
  filters,
  onChange,
  onReset,
  meters,
  total,
}: Props) {
  const hasAny =
    filters.meterKey !== "all" ||
    filters.linesMin != null ||
    filters.linesMax != null ||
    filters.wordsMin != null ||
    filters.wordsMax != null ||
    filters.query !== "" ||
    filters.lemma !== "" ||
    filters.posGroup !== "all";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Размер
          <select
            value={filters.meterKey}
            onChange={(e) => onChange("meterKey", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="all">Любой</option>
            <option value="none">Не определён</option>
            {meters.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Строк: от–до
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={filters.linesMin ?? ""}
              onChange={(e) =>
                onChange(
                  "linesMin",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="0"
              aria-label="Минимум строк"
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-900"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              min={0}
              value={filters.linesMax ?? ""}
              onChange={(e) =>
                onChange(
                  "linesMax",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="∞"
              aria-label="Максимум строк"
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500">
          Слов: от–до
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={filters.wordsMin ?? ""}
              onChange={(e) =>
                onChange(
                  "wordsMin",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="0"
              aria-label="Минимум слов"
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-900"
            />
            <span className="text-slate-400">—</span>
            <input
              type="number"
              min={0}
              value={filters.wordsMax ?? ""}
              onChange={(e) =>
                onChange(
                  "wordsMax",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              placeholder="∞"
              aria-label="Максимум слов"
              className="w-full min-w-0 rounded-lg border border-slate-300 px-2 py-2 text-sm outline-none focus:border-slate-900"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
          Поиск по тексту
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange("query", e.target.value)}
            placeholder="Слово или фраза"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
          Лемма
          <input
            type="search"
            value={filters.lemma}
            onChange={(e) => onChange("lemma", e.target.value)}
            placeholder="например: ночь (только среди проанализированных)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-slate-500 sm:col-span-2">
          Доминирующая часть речи
          <select
            value={filters.posGroup}
            onChange={(e) => onChange("posGroup", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
          >
            <option value="all">Любая</option>
            {POS_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filters.posGroup !== "all" && (
        <p className="mt-2 text-xs text-slate-400">
          Фильтр по части речи учитывает только проанализированные стихи.
        </p>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-slate-500">
          Найдено: <strong className="text-slate-900">{total}</strong>
        </span>
        {hasAny && (
          <button
            onClick={onReset}
            className="rounded text-sm text-slate-500 transition hover:text-slate-900 focus:outline-none focus-visible:underline"
          >
            Сбросить фильтры
          </button>
        )}
      </div>
    </div>
  );
}
