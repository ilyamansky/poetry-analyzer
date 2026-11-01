import { useState } from "react";
import { usePoemsStore } from "../store/poemsStore";
import { ChevronRight } from "./icons";

export default function StopwordsEditor() {
  const stopwords = usePoemsStore((s) => s.stopwords);
  const addStopword = usePoemsStore((s) => s.addStopword);
  const removeStopword = usePoemsStore((s) => s.removeStopword);
  const resetStopwords = usePoemsStore((s) => s.resetStopwords);

  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);

  const submit = () => {
    const w = input.trim();
    if (!w) return;
    addStopword(w);
    setInput("");
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 px-3 py-2 text-left transition hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center text-slate-400">
          <ChevronRight open={open} />
        </span>
        <span className="flex-1 text-sm font-medium text-slate-700">
          Стоп-слова
        </span>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-500">
          {stopwords.length}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/60 p-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Добавить слово"
              className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <button
              onClick={submit}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Добавить
            </button>
          </div>

          {stopwords.length === 0 ? (
            <p className="text-sm text-slate-500">
              Список пуст — в топ попадут все слова.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {stopwords.map((w) => (
                <span
                  key={w}
                  className="inline-flex items-center gap-1 rounded-lg bg-white py-1 pl-2 pr-1 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  {w}
                  <button
                    type="button"
                    onClick={() => removeStopword(w)}
                    className="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                    aria-label={`Убрать «${w}»`}
                    title="Убрать из списка"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                if (confirm("Сбросить стоп-слова к стандартному списку?")) {
                  resetStopwords();
                }
              }}
              className="rounded text-sm text-slate-500 transition hover:text-slate-900 focus:outline-none focus-visible:underline"
            >
              Сбросить к стандартным
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
