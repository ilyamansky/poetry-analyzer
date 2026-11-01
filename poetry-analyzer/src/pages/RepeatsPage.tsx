// src/pages/RepeatsPage.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useGlobalCorpusSelection } from "../hooks/useGlobalCorpusSelection";
import { usePoemsStore } from "../store/poemsStore";
import { findRepeatedLines, type RepeatedLine } from "../lib/repeats";
import { decodeCorpusRef } from "../store/comparisonStore";
import { cn } from "../lib/cn";

type MobileView = "list" | "detail";

export default function RepeatsPage() {
  const poems = usePoemsStore((s) => s.poems);
  const groups = usePoemsStore((s) => s.groups);
  const { a: poemsA, keyA, setA } = useGlobalCorpusSelection();

  const [minLength, setMinLength] = useState(10);
  const [includeNear, setIncludeNear] = useState(false);
  const [externalOnly, setExternalOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<MobileView>("list");

  const repeats = useMemo(
    () =>
      findRepeatedLines(poemsA, {
        minLength,
        includeNear,
        maxLevenshtein: 2,
      }),
    [poemsA, minLength, includeNear],
  );

  const filtered = useMemo(() => {
    let base = repeats;
    if (externalOnly) base = base.filter((g) => g.poemCount >= 2);
    const q = query.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (g) =>
          g.displayLine.toLowerCase().includes(q) ||
          g.variants.some((v) => v.includes(q)),
      );
    }
    return base;
  }, [repeats, externalOnly, query]);

  const selected = useMemo<RepeatedLine | null>(() => {
    if (filtered.length === 0) return null;
    if (selectedKey) {
      const found = filtered.find((g) => g.normalized === selectedKey);
      if (found) return found;
    }
    return filtered[0];
  }, [filtered, selectedKey]);

  const totalOccurrences = filtered.reduce((s, g) => s + g.totalOccurrences, 0);

  const handleSelect = (key: string) => {
    setSelectedKey(key);
    setMobileView("detail");
  };

  const handleCorpusChange = (value: string) => {
    setA(decodeCorpusRef(value));
    setMobileView("list");
    setSelectedKey(null);
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
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Повторы строк</h1>
        <p className="mt-1 text-sm text-slate-600">
          Строки, встречающиеся в корпусе больше одного раза. Нормализация —
          нижний регистр, без пунктуации, схлопнутые пробелы.
        </p>
      </div>

      {/* Селектор корпуса — как на /poems */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="shrink-0">Показать:</span>
          <select
            aria-label="Какой корпус анализировать"
            value={keyA}
            onChange={(e) => handleCorpusChange(e.target.value)}
            className="max-w-65 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
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

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:gap-4 sm:p-4">
        <label className="flex items-center gap-2 text-slate-600">
          Мин. длина:
          <input
            type="number"
            min={3}
            max={60}
            value={minLength}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isFinite(n))
                setMinLength(Math.max(3, Math.min(60, n)));
            }}
            className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1"
          />
          <span className="text-xs text-slate-400">симв.</span>
        </label>

        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={includeNear}
            onChange={(e) => setIncludeNear(e.target.checked)}
          />
          Неточные (Левенштейн ≤ 2)
        </label>

        <label className="flex items-center gap-2 text-slate-600">
          <input
            type="checkbox"
            checked={externalOnly}
            onChange={(e) => setExternalOnly(e.target.checked)}
          />
          Только между стихами
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Kpi label="Групп" value={String(filtered.length)} />
        <Kpi label="Вхождений" value={String(totalOccurrences)} />
        <Kpi
          label="Строк"
          value={String(
            poemsA.reduce(
              (s, p) =>
                s + p.content.split(/\r?\n/).filter((l) => l.trim()).length,
              0,
            ),
          )}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          {repeats.length === 0
            ? "Повторов не найдено. Уменьшите минимальную длину строки."
            : "Ничего не найдено по фильтру."}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-[380px_1fr]">
          <div
            className={cn(
              "flex-col rounded-xl border border-slate-200 bg-white md:flex md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]",
              mobileView === "detail" ? "hidden md:flex" : "flex",
            )}
          >
            <div className="border-b border-slate-100 p-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по строке…"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"
              />
            </div>
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {filtered.map((g) => {
                const active = selected?.normalized === g.normalized;
                return (
                  <li key={g.normalized}>
                    <button
                      onClick={() => handleSelect(g.normalized)}
                      className={cn(
                        "w-full px-3 py-2.5 text-left transition",
                        active
                          ? "bg-slate-900 text-white"
                          : "hover:bg-slate-50",
                      )}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            "flex-1 truncate font-mono text-sm",
                            active ? "text-white" : "text-slate-800",
                          )}
                        >
                          {g.displayLine}
                        </span>
                        {g.hasInternalRepeat && (
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                              active
                                ? "bg-white/20 text-white"
                                : "bg-amber-100 text-amber-900",
                            )}
                          >
                            реф.
                          </span>
                        )}
                      </div>
                      <div
                        className={cn(
                          "mt-1 text-xs tabular-nums",
                          active ? "text-white/70" : "text-slate-500",
                        )}
                      >
                        {g.poemCount}{" "}
                        {plural(g.poemCount, "стих", "стиха", "стихов")} ·{" "}
                        {g.totalOccurrences}{" "}
                        {plural(
                          g.totalOccurrences,
                          "вхождение",
                          "вхождения",
                          "вхождений",
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && (
            <div
              className={cn(
                "md:block",
                mobileView === "list" ? "hidden md:block" : "block",
              )}
            >
              <RepeatedDetail
                group={selected}
                onBack={() => setMobileView("list")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RepeatedDetail({
  group,
  onBack,
}: {
  group: RepeatedLine;
  onBack: () => void;
}) {
  const byPoem = useMemo(() => {
    const map = new Map<
      string,
      {
        poemId: string;
        poemIndex: number;
        poemFirstLine: string;
        lines: { lineIndex: number; originalLine: string }[];
      }
    >();
    for (const o of group.occurrences) {
      let entry = map.get(o.poemId);
      if (!entry) {
        entry = {
          poemId: o.poemId,
          poemIndex: o.poemIndex,
          poemFirstLine: o.poemFirstLine,
          lines: [],
        };
        map.set(o.poemId, entry);
      }
      entry.lines.push({
        lineIndex: o.lineIndex,
        originalLine: o.originalLine,
      });
    }
    return [...map.values()].sort((a, b) => a.poemIndex - b.poemIndex);
  }, [group.occurrences]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 p-3 sm:p-4">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 text-sm text-slate-500 hover:text-slate-900 md:hidden"
        >
          ← К списку
        </button>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="flex-1 font-mono text-sm font-medium text-slate-900 sm:text-base">
            «{group.displayLine}»
          </h2>
          {group.hasInternalRepeat && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900">
              рефрен
            </span>
          )}
        </div>
        <p className="mt-1.5 text-sm text-slate-500">
          {group.poemCount} {plural(group.poemCount, "стих", "стиха", "стихов")}{" "}
          · {group.totalOccurrences}{" "}
          {plural(
            group.totalOccurrences,
            "вхождение",
            "вхождения",
            "вхождений",
          )}
        </p>
        {group.variants.length > 1 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-900">
              {group.variants.length} вариантов (неточные совпадения)
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {group.variants.map((v) => (
                <li key={v} className="font-mono">
                  · {v}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <ul className="divide-y divide-slate-100">
        {byPoem.map((p) => (
          <li key={p.poemId} className="p-3 sm:p-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                to={`/poems/${p.poemId}`}
                className="font-mono text-sm font-medium text-slate-900 hover:underline sm:text-base"
              >
                #{p.poemIndex}
              </Link>
              <span className="text-xs text-slate-500 sm:text-sm">
                {plural(p.lines.length, "строка", "строки", "строк")}:{" "}
                {p.lines
                  .map((l) => l.lineIndex + 1)
                  .sort((a, b) => a - b)
                  .join(", ")}
              </span>
              {p.lines.length > 1 && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 tabular-nums">
                  ×{p.lines.length}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 sm:text-sm">
              {p.poemFirstLine}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 sm:text-xs">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl">
        {value}
      </p>
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
