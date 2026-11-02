import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "../components/FileUpload";
import { parsePoemsDetailed } from "../lib/parser";
import { plural } from "../lib/plural";
import { usePoemsStore } from "../store/poemsStore";
import { useAnalysisStore } from "../store/analysisStore";

const LARGE_CORPUS_THRESHOLD = 500;

function estimateAnalysisMinutes(poemCount: number): number {
  const seconds = poemCount * 0.05 + 10;
  return Math.max(1, Math.ceil(seconds / 60));
}

export default function UploadPage() {
  const navigate = useNavigate();
  const setPoems = usePoemsStore((s) => s.setPoems);
  const clear = usePoemsStore((s) => s.clear);
  const fileName = usePoemsStore((s) => s.fileName);
  const count = usePoemsStore((s) => s.poems.length);

  const clearAnalyses = useAnalysisStore((s) => s.clearAll);

  const [error, setError] = useState<string | null>(null);

  const handleFile = (text: string, name: string) => {
    setError(null);
    const result = parsePoemsDetailed(text);

    if (result.poems.length === 0) {
      setError(
        "Не найдено ни одного стихотворения. Проверьте содержимое файла.",
      );
      return;
    }

    if (!result.hasSeparator && result.totalLength > 50_000) {
      setError(
        `В файле нет разделителя ***, а объём ${Math.round(result.totalLength / 1024)} КБ. ` +
          `Весь текст попадёт в одно «стихотворение», и лемматизация может не уложиться в лимит. ` +
          `Добавьте строку *** между стихами и загрузите снова.`,
      );
      return;
    }

    if (result.poems.length > LARGE_CORPUS_THRESHOLD) {
      const minutes = estimateAnalysisMinutes(result.poems.length);
      const ok = window.confirm(
        `Загружено ${result.poems.length} ${plural(result.poems.length, "стихотворение", "стихотворения", "стихотворений")}.\n\n` +
          `Лемматизация такого корпуса займёт примерно ${minutes} ${plural(minutes, "минуту", "минуты", "минут")} и требует, чтобы вкладка была открыта до конца.\n\n` +
          `Продолжить?`,
      );
      if (!ok) return;
    }

    clearAnalyses();
    setPoems(result.poems, name);
    navigate("/poems");
  };

  const handleClear = () => {
    const ok = window.confirm(
      "Очистить корпус и все результаты анализа? Это действие нельзя отменить.",
    );
    if (!ok) return;
    clearAnalyses();
    clear();
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">Загрузка корпуса</h1>
        <p className="mt-1 text-sm text-slate-600 sm:text-base">
          Файл <code className="rounded bg-slate-200 px-1">.txt</code> в
          кодировке <strong>UTF-8</strong>, размером <strong>до 1 МБ</strong>{" "}
          (это ~1500–3000 стихов). Стихи разделяются строкой{" "}
          <code className="rounded bg-slate-200 px-1">***</code>.
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
          <li>
            Только русский текст — другие языки дадут бессмысленные леммы.
          </li>
          <li>Файлы в Windows-1251 или UTF-16 не принимаются.</li>
          <li>
            Если файл не открывается в UTF-8 — сохраните его в VS Code или
            Notepad++ как «UTF-8 без BOM».
          </li>
        </ul>
      </div>

      <FileUpload onFile={handleFile} />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {count > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <p>
            Уже загружено: <strong>{count}</strong>{" "}
            {plural(count, "стихотворение", "стихотворения", "стихотворений")}
            {fileName && <> из «{fileName}»</>}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => navigate("/poems")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Перейти к списку
            </button>
            <button
              onClick={handleClear}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm transition hover:bg-slate-100"
            >
              Очистить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
