// src/components/AnalysisBanner.tsx

import { useState } from "react";
import { Link } from "react-router-dom";
import { isFullAnalysis } from "../lib/api";
import { plural } from "../lib/plural";
import { useAnalysisStore } from "../store/analysisStore";
import { useAnalysisProgressStore } from "../store/analysisProgressStore";
import { usePoemsStore } from "../store/poemsStore";

export default function AnalysisBanner() {
  const poems = usePoemsStore((s) => s.poems);
  const analyses = useAnalysisStore((s) => s.analyses);
  const clearAll = useAnalysisStore((s) => s.clearAll);

  const runningMode = useAnalysisProgressStore((s) => s.runningMode);
  const progress = useAnalysisProgressStore((s) => s.progress);
  const lastFailed = useAnalysisProgressStore((s) => s.lastFailed);
  const lastCancelled = useAnalysisProgressStore((s) => s.lastCancelled);
  const lastError = useAnalysisProgressStore((s) => s.lastError);
  const start = useAnalysisProgressStore((s) => s.start);
  const cancel = useAnalysisProgressStore((s) => s.cancel);
  const clearFailed = useAnalysisProgressStore((s) => s.clearFailed);
  const clearLastError = useAnalysisProgressStore((s) => s.clearLastError);

  const [showFailed, setShowFailed] = useState(false);

  const total = poems.length;
  const withLemmas = poems.filter((p) => analyses[p.id]).length;
  const withFull = poems.filter(
    (p) => analyses[p.id] && isFullAnalysis(analyses[p.id]),
  ).length;

  const allAnalyzed = total > 0 && withFull === total;

  // ─── Идёт анализ: прогресс-бар ──────────────────────────────
  if (runningMode && progress) {
    const pct =
      progress.total > 0
        ? Math.round((progress.done / progress.total) * 100)
        : 0;
    return (
      <div className="rounded-xl border border-slate-300 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-slate-700">
            {runningMode === "full" ? "Полный анализ" : "Лемматизация"}:{" "}
            <strong>{progress.done}</strong> / {progress.total}
            <span className="ml-2 text-slate-400">({pct}%)</span>
            {progress.failed.length > 0 && (
              <span className="ml-2 text-red-600">
                ошибок: {progress.failed.length}
              </span>
            )}
          </span>
          <button
            onClick={cancel}
            className="text-red-600 hover:underline"
            type="button"
          >
            Отменить
          </button>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-slate-900 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // ─── Всё проанализировано полным: тонкая строка ─────────────
  if (allAnalyzed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        <span>
          ✓ Все {total}{" "}
          {plural(total, "стихотворение", "стихотворения", "стихотворений")}{" "}
          проанализированы
          {lastFailed.length > 0 && (
            <span className="ml-2 text-amber-700">
              · последний запуск с ошибками: {lastFailed.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          {lastFailed.length > 0 && (
            <button
              onClick={() => setShowFailed((v) => !v)}
              className="text-xs text-amber-700 hover:underline"
              type="button"
            >
              {showFailed ? "скрыть ошибки" : "показать ошибки"}
            </button>
          )}
          <button
            onClick={() => {
              if (
                confirm(
                  "Пересчитать анализ заново для всего корпуса? Текущие результаты будут удалены.",
                )
              ) {
                clearAll();
                clearFailed();
                clearLastError();
                void start(poems, "full");
              }
            }}
            className="text-xs text-slate-600 hover:text-slate-900"
            type="button"
          >
            Пересчитать
          </button>
        </div>
        {showFailed && lastFailed.length > 0 && (
          <ul className="mt-2 w-full max-h-40 overflow-auto rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            {lastFailed.map((f) => (
              <li key={f.poemId}>
                №{f.index + 1}: {f.error}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ─── Не завершено: основной баннер ─────────────────────────
  const notAnalyzed = total - withLemmas;
  const needFull = withLemmas - withFull;

  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex flex-wrap items-baseline gap-2">
        <strong>
          {lastCancelled
            ? "Лингвистический анализ отменён"
            : "Лингвистический анализ не завершён"}
        </strong>
        <span className="text-xs text-amber-800">
          {withFull === 0
            ? "Без него недоступны размеры, части речи, леммы, уверенность и рифма."
            : lastCancelled
              ? `Проанализировано ${withFull} из ${total}.`
              : `Полностью проанализировано ${withFull} из ${total}.`}
        </span>
      </div>

      {lastError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <span>
            <strong>Не удалось запустить анализ:</strong> {lastError}
          </span>
          <button
            onClick={clearLastError}
            className="shrink-0 text-red-600 hover:text-red-800"
            aria-label="Скрыть ошибку"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void start(poems, "full")}
          disabled={needFull === 0 && notAnalyzed === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          {withFull === 0
            ? lastCancelled
              ? `Продолжить полный анализ (${total})`
              : `Полный анализ (${total})`
            : needFull > 0
              ? `Доанализировать полным (${needFull})`
              : "Полный анализ выполнен"}
        </button>

        {notAnalyzed > 0 && (
          <button
            onClick={() => void start(poems, "lemmas")}
            className="rounded-lg border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            type="button"
          >
            {withLemmas === 0
              ? `Только леммы (быстро) (${total})`
              : `Доанализировать леммы (${notAnalyzed})`}
          </button>
        )}

        {withLemmas > 0 && (
          <button
            onClick={() => {
              if (
                confirm(
                  "Удалить кэш анализа? Результаты придётся считать заново.",
                )
              ) {
                clearAll();
                clearFailed();
                clearLastError();
              }
            }}
            className="text-xs text-amber-800 underline hover:text-amber-950"
            type="button"
          >
            Сбросить анализ ({withLemmas})
          </button>
        )}

        <Link
          to="/poems"
          className="ml-auto text-xs text-amber-800 underline hover:text-amber-950"
        >
          к списку стихов
        </Link>
      </div>

      {lastFailed.length > 0 && (
        <div>
          <button
            onClick={() => setShowFailed((v) => !v)}
            className="text-xs text-red-700 hover:underline"
            type="button"
          >
            Не удалось проанализировать: {lastFailed.length}{" "}
            {showFailed ? "▲" : "▼"}
          </button>
          {showFailed && (
            <ul className="mt-1 max-h-40 overflow-auto rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {lastFailed.map((f) => (
                <li key={f.poemId}>
                  №{f.index + 1}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
