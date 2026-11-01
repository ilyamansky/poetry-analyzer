import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FileUpload from "../components/FileUpload";
import { parsePoems } from "../lib/parser";
import { plural } from "../lib/plural";
import { usePoemsStore } from "../store/poemsStore";
import { useAnalysisStore } from "../store/analysisStore";

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
    const poems = parsePoems(text);
    if (poems.length === 0) {
      setError(
        "Не удалось найти ни одного стихотворения. Проверьте разделители ***.",
      );
      return;
    }
    clearAnalyses();
    setPoems(poems, name);
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
          Файл со стихами, разделёнными строкой{" "}
          <code className="rounded bg-slate-200 px-1">***</code>.
        </p>
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
