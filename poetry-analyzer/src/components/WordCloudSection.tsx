import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import WordCloud, { type CloudWord } from "./WordCloud";
import { scoreLemmas } from "../lib/compare";
import { tokenizeWords } from "../lib/tokenize";
import { useQueryParams } from "../hooks/useQueryParams";
import type { PoemAnalysis } from "../lib/api";
import type { Poem } from "../types";

const COLOR_A = "#1d4ed8";
const COLOR_B = "#b91c1c";
const COLOR_NEUTRAL = "#94a3b8";
const LOG_ODDS_THRESHOLD = 1;

type CloudMode = "forms" | "lemmas";

interface Props {
  poemsA: Poem[];
  poemsB: Poem[] | null;
  labelA: string;
  labelB: string | null;
  stopwords: Set<string>;
  /** Нужен для режима «Леммы» и для маппинга словоформа → лемма при клике. */
  analyses: Record<string, PoemAnalysis>;
}

function countForms(poems: Poem[], stopwords: Set<string>) {
  const freq = new Map<string, number>();
  for (const p of poems) {
    for (const w of tokenizeWords(p.content)) {
      if (w.length <= 1 || stopwords.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  return freq;
}

function countLemmas(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  stopwords: Set<string>,
) {
  const freq = new Map<string, number>();
  for (const p of poems) {
    const a = analyses[p.id];
    if (!a) continue;
    for (const t of a.tokens) {
      const lemma = t.lemma;
      if (lemma.length <= 1 || stopwords.has(lemma)) continue;
      freq.set(lemma, (freq.get(lemma) ?? 0) + 1);
    }
  }
  return freq;
}

/** Словоформа (lowercase) → лемма. Первое вхождение выигрывает. */
function buildFormToLemma(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of poems) {
    const a = analyses[p.id];
    if (!a) continue;
    for (const t of a.tokens) {
      const form = t.original.toLowerCase();
      if (!map.has(form)) map.set(form, t.lemma);
    }
  }
  return map;
}

function toCloudWords(
  entries: { text: string; count: number; color?: string }[],
): CloudWord[] {
  const max = Math.max(1, ...entries.map((e) => e.count));
  return entries.map((e) => ({
    text: e.text,
    size: 12 + 42 * Math.sqrt(e.count / max),
    color: e.color,
  }));
}

export default function WordCloudSection({
  poemsA,
  poemsB,
  labelA,
  labelB,
  stopwords,
  analyses,
}: Props) {
  const { getParam, setParam } = useQueryParams();
  const navigate = useNavigate();

  const count = getParam("cloud", "100");
  const topN = Number(count) || 100;

  const modeParam = getParam("wcmode", "forms");
  const mode: CloudMode = modeParam === "lemmas" ? "lemmas" : "forms";

  const switchMode = (next: CloudMode) => {
    setParam("wcmode", next, "forms");
  };

  // Частоты по выбранному режиму
  const freqA = useMemo(
    () =>
      mode === "lemmas"
        ? countLemmas(poemsA, analyses, stopwords)
        : countForms(poemsA, stopwords),
    [mode, poemsA, analyses, stopwords],
  );
  const freqB = useMemo(
    () =>
      poemsB
        ? mode === "lemmas"
          ? countLemmas(poemsB, analyses, stopwords)
          : countForms(poemsB, stopwords)
        : null,
    [mode, poemsB, analyses, stopwords],
  );

  // Маппинг словоформа → лемма (только нужен в режиме "forms")
  const formToLemma = useMemo(
    () => (mode === "forms" ? buildFormToLemma(poemsA, analyses) : null),
    [mode, poemsA, analyses],
  );

  const words = useMemo(() => {
    if (!freqB) {
      const entries = [...freqA.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, topN)
        .map(([text, count]) => ({ text, count }));
      return toCloudWords(entries);
    }
    const named = (f: Map<string, number>) =>
      [...f.entries()].map(([name, cnt]) => ({ name, count: cnt }));
    const scored = scoreLemmas(named(freqA), named(freqB));
    const entries = scored
      .sort((a, b) => b.countA + b.countB - (a.countA + a.countB))
      .slice(0, topN)
      .map((s) => ({
        text: s.name,
        count: s.countA + s.countB,
        color:
          s.logOdds > LOG_ODDS_THRESHOLD
            ? COLOR_A
            : s.logOdds < -LOG_ODDS_THRESHOLD
              ? COLOR_B
              : COLOR_NEUTRAL,
      }));
    return toCloudWords(entries);
  }, [freqA, freqB, topN]);

  const comparing = freqB != null && labelB != null;

  // Пустое состояние для режима «Леммы»: анализа нет → подсказка
  const hasAnalysesA = useMemo(
    () => poemsA.some((p) => analyses[p.id]),
    [poemsA, analyses],
  );

  const lemmasEmpty = mode === "lemmas" && !hasAnalysesA && !comparing;

  const handleWordClick = (word: string) => {
    if (mode === "lemmas") {
      // Это уже лемма — сразу на портрет
      navigate(`/lemma/${encodeURIComponent(word)}`);
      return;
    }
    // Режим "forms": попытаться найти лемму через analyses
    const lemma = formToLemma?.get(word.toLowerCase());
    if (lemma) {
      navigate(`/lemma/${encodeURIComponent(lemma)}`);
    } else {
      // Fallback: анализа нет или словоформа не найдена — в конкорданс
      navigate(`/concordance?q=${encodeURIComponent(word)}&mode=word`);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-700">
          Облако слов
          {comparing && (
            <span className="ml-2 text-xs text-slate-400">
              цвет — специфичность для корпуса
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          {/* Переключатель Словоформы / Леммы */}
          <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            <button
              type="button"
              onClick={() => switchMode("forms")}
              className={
                mode === "forms"
                  ? "bg-slate-900 px-3 py-1.5 text-white"
                  : "bg-white px-3 py-1.5 hover:bg-slate-100"
              }
              aria-pressed={mode === "forms"}
            >
              Словоформы
            </button>
            <button
              type="button"
              onClick={() => switchMode("lemmas")}
              className={
                mode === "lemmas"
                  ? "bg-slate-900 px-3 py-1.5 text-white"
                  : "bg-white px-3 py-1.5 hover:bg-slate-100"
              }
              aria-pressed={mode === "lemmas"}
              title={
                hasAnalysesA
                  ? "Леммы из анализа"
                  : "Требует лингвистического анализа"
              }
            >
              Леммы
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            Слов:
            <select
              value={count}
              onChange={(e) => setParam("cloud", e.target.value, "100")}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </label>
        </div>
      </div>

      {lemmasEmpty ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>
            Облако лемм строится по результатам лингвистического анализа.
            Запустите его в блоке «Лингвистический анализ» ниже (или на странице
            «Статистика» — там же).
          </p>
        </div>
      ) : (
        <WordCloud words={words} onWordClick={handleWordClick} />
      )}

      {mode === "forms" && formToLemma && (
        <p className="mt-2 text-xs text-slate-400">
          Клик по слову — страница леммы (если анализ запущен), иначе —
          конкорданс по форме.
        </p>
      )}
      {mode === "lemmas" && !lemmasEmpty && (
        <p className="mt-2 text-xs text-slate-400">
          Клик по слову — страница леммы.
        </p>
      )}

      {comparing && (
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COLOR_A }}
            />
            чаще в «{labelA}»
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COLOR_B }}
            />
            чаще в «{labelB}»
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: COLOR_NEUTRAL }}
            />
            без явного перевеса
          </span>
        </div>
      )}
    </div>
  );
}
