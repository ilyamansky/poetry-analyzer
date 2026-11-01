import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePoemsStore } from "../store/poemsStore";
import type { Poem } from "../types";
import { cn } from "../lib/cn";
import { ChevronRight } from "../components/icons";

type CreateMode = "empty" | "range";

export default function GroupsPage() {
  const poems = usePoemsStore((s) => s.poems);
  const groups = usePoemsStore((s) => s.groups);
  const createGroup = usePoemsStore((s) => s.createGroup);
  const renameGroup = usePoemsStore((s) => s.renameGroup);
  const deleteGroup = usePoemsStore((s) => s.deleteGroup);
  const removeFromGroup = usePoemsStore((s) => s.removeFromGroup);

  const [name, setName] = useState("");
  const [mode, setMode] = useState<CreateMode>("empty");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const poemById = useMemo(() => {
    const m = new Map<string, Poem>();
    poems.forEach((p) => m.set(p.id, p));
    return m;
  }, [poems]);

  const total = poems.length;

  const range = useMemo(() => {
    if (mode !== "range") return null;
    const s = startInput.trim() === "" ? 1 : Number(startInput);
    const e = endInput.trim() === "" ? total : Number(endInput);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
    if (s < 1 || e < 1) return null;
    const from = Math.max(1, Math.min(Math.min(s, e), total));
    const to = Math.max(1, Math.min(Math.max(s, e), total));
    const ids = poems
      .filter((p) => p.index >= from && p.index <= to)
      .map((p) => p.id);
    return { from, to, ids };
  }, [mode, startInput, endInput, poems, total]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Введите название группы");
      return;
    }
    if (mode === "range") {
      if (!range || range.ids.length === 0) {
        setError(`Укажите корректный диапазон: номера от 1 до ${total}`);
        return;
      }
      createGroup(trimmed, range.ids);
    } else {
      createGroup(trimmed);
    }
    setName("");
    setStartInput("");
    setEndInput("");
    setMode("empty");
  };

  if (poems.length === 0) {
    return (
      <p className="text-slate-600">
        Сначала загрузите корпус на странице «Загрузка».
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold sm:text-2xl">Группы</h1>
      <p className="mt-1 text-sm text-slate-600 sm:text-base">
        Мини-корпусы для сравнения. Стих может входить в несколько групп.
      </p>

      <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:mt-6 sm:p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Название новой группы"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900 sm:min-w-64"
          />
          <div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-slate-300 text-sm">
            <button
              type="button"
              onClick={() => setMode("empty")}
              className={cn(
                "px-3 py-2 transition",
                mode === "empty"
                  ? "bg-slate-900 text-white"
                  : "bg-white hover:bg-slate-100",
              )}
            >
              Пустая
            </button>
            <button
              type="button"
              onClick={() => setMode("range")}
              className={cn(
                "px-3 py-2 transition",
                mode === "range"
                  ? "bg-slate-900 text-white"
                  : "bg-white hover:bg-slate-100",
              )}
            >
              По диапазону
            </button>
          </div>
        </div>

        {mode === "range" && (
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="hidden sm:inline">С №</span>
              <input
                type="number"
                min={1}
                max={total}
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="1"
                aria-label="Начальный номер"
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900 sm:w-24"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <span className="hidden sm:inline">по №</span>
              <input
                type="number"
                min={1}
                max={total}
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder={String(total)}
                aria-label="Конечный номер"
                className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-900 sm:w-24"
              />
            </label>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleCreate}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Создать группу
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 sm:mt-8 sm:text-base">
          Групп пока нет. Создайте первую или выделите стихи на странице «Стихи»
          и объедините их в группу.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 sm:mt-6 sm:space-y-3">
          {groups.map((g) => {
            const isOpen = expanded.has(g.id);
            const groupPoems = g.poemIds
              .map((id) => poemById.get(id))
              .filter((p): p is Poem => Boolean(p));

            return (
              <li
                key={g.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center gap-1 px-2 py-2 sm:px-3">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(g.id)}
                    aria-label={isOpen ? "Свернуть" : "Развернуть"}
                    aria-expanded={isOpen}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <ChevronRight open={isOpen} />
                  </button>

                  <input
                    value={g.name}
                    onChange={(e) => renameGroup(g.id, e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim())
                        renameGroup(g.id, "Без названия");
                    }}
                    aria-label="Название группы"
                    className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-900 transition hover:border-slate-200 hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:outline-none sm:text-base"
                  />

                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs tabular-nums text-slate-500 sm:px-2">
                    {g.poemIds.length}
                  </span>

                  <Link
                    to={`/poems?a=${g.id}`}
                    title="Открыть в списке стихов"
                    aria-label={`Открыть группу «${g.name}»`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Удалить группу «${g.name}»?`))
                        deleteGroup(g.id);
                    }}
                    title="Удалить группу"
                    aria-label={`Удалить группу «${g.name}»`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 px-2 py-2 sm:px-3">
                    {groupPoems.length === 0 ? (
                      <p className="px-2 py-1 text-sm text-slate-400">
                        В группе нет стихов.
                      </p>
                    ) : (
                      <ul className="space-y-0.5">
                        {groupPoems.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-1 rounded-lg px-1 py-1 transition hover:bg-white sm:gap-2 sm:px-2"
                          >
                            <Link
                              to={`/poems/${p.id}`}
                              className="flex-1 truncate text-sm text-slate-700 hover:text-slate-900"
                            >
                              <span className="tabular-nums text-slate-400">
                                №{p.index}
                              </span>
                              <span className="mx-1.5 text-slate-300">·</span>
                              <span className="text-slate-500">
                                {p.content.split("\n")[0].slice(0, 80)}
                              </span>
                            </Link>
                            <button
                              type="button"
                              onClick={() => removeFromGroup(g.id, [p.id])}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-300 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                              aria-label={`Убрать стихотворение ${p.index} из группы`}
                              title="Убрать из группы"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                              >
                                <path d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
