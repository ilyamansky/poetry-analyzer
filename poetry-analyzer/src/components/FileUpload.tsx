import { useState } from "react";

interface Props {
  onFile: (text: string, fileName: string) => void;
}

const MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
const MIN_CYRILLIC_RATIO = 0.5;

function isTxtFile(file: File): boolean {
  const nameOk = /\.txt$/i.test(file.name);
  const mimeOk = file.type === "text/plain" || file.type === "";
  return nameOk || mimeOk;
}

/** Декодирует строго как UTF-8. Бросает, если байты невалидны. */
function decodeUtf8Strict(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

interface LanguageCheck {
  cyrillicRatio: number;
  nonRussianCount: number;
}

function checkLanguage(text: string): LanguageCheck {
  const sample = text.slice(0, 5000);
  const letters = sample.match(/\p{L}/gu) ?? [];
  const cyrillic = sample.match(/\p{Script=Cyrillic}/gu) ?? [];
  const nonRussian = sample.match(/[іїєґўђјљњћџѓќѕ]/gu) ?? [];

  return {
    cyrillicRatio: letters.length > 0 ? cyrillic.length / letters.length : 0,
    nonRussianCount: nonRussian.length,
  };
}

export default function FileUpload({ onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const readFile = async (file: File) => {
    setError(null);
    setWarning(null);
    setInfo(null);

    if (!isTxtFile(file)) {
      setError(
        `Поддерживается только .txt. Выбран файл «${file.name}» (${file.type || "без типа"}).`,
      );
      return;
    }
    if (file.size === 0) {
      setError("Файл пустой.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(
        `Файл слишком большой (${(file.size / 1024 / 1024).toFixed(2)} МБ). Максимум — 1 МБ (это ~1500–3000 стихов).`,
      );
      return;
    }

    setReading(true);
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      let text: string;
      try {
        text = decodeUtf8Strict(bytes);
      } catch {
        setError(
          "Файл не в кодировке UTF-8. Откройте его в VS Code / Notepad++ / современном «Блокноте» и сохраните как «UTF-8» (без BOM), затем загрузите снова.",
        );
        return;
      }

      if (text.trim().length < 10) {
        setError("В файле почти нет текста.");
        return;
      }

      const lang = checkLanguage(text);
      if (lang.cyrillicRatio < MIN_CYRILLIC_RATIO) {
        setError(
          `Текст не на русском: доля кириллицы ${Math.round(lang.cyrillicRatio * 100)}% (нужно ≥ ${Math.round(MIN_CYRILLIC_RATIO * 100)}%). ` +
            "Скорее всего, файл на другом языке — лемматизация даст бессмысленный результат.",
        );
        return;
      }
      if (lang.nonRussianCount > 0) {
        setWarning(
          `Похоже на украинский/сербский/другой язык (найдено ${lang.nonRussianCount} нерусских кириллических букв). Лемматизация может работать некорректно.`,
        );
      }

      setInfo(
        `Прочитано: ${file.name} · UTF-8 · ${Math.round(file.size / 1024)} КБ`,
      );
      onFile(text, file.name);
    } catch (e) {
      console.error("readFile failed:", e);
      setError("Не удалось прочитать файл.");
    } finally {
      setReading(false);
    }
  };

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) readFile(file);
        }}
        className={`block cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-12 ${
          dragging
            ? "border-slate-900 bg-slate-100"
            : "border-slate-300 bg-white hover:border-slate-500"
        }`}
      >
        <p className="text-lg font-medium">
          {reading ? "Чтение файла…" : "Выберите файл"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          .txt · UTF-8 · до 1 МБ · только русский текст
        </p>
        <input
          type="file"
          accept=".txt,text/plain"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
            e.target.value = "";
          }}
        />
      </label>

      {error && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {warning && !error && (
        <div
          role="status"
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
        >
          {warning}
        </div>
      )}
      {info && !error && !warning && (
        <p className="mt-2 text-xs text-slate-500">{info}</p>
      )}
    </div>
  );
}
