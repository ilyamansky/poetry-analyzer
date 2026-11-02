import { tokenizeWords } from "./tokenize";
import type { Poem } from "../types";

export interface Bucket {
  range: string;
  count: number;
}

export interface WordFreq {
  word: string;
  count: number;
}

/** Сводка по одному числовому ряду (длина строк, длина стихотворений и т.д.). */
export interface DistSummary {
  min: number;
  max: number;
  mean: number;
  median: number;
  mode: number;
  modeCount: number;
}

export interface StatsOptions {
  stopwords?: Set<string>;
  topN?: number;
}

export interface CorpusStats {
  poemCount: number;
  totalLines: number;
  totalWords: number;
  totalChars: number;
  lineLengthDist: Bucket[];
  poemLengthDist: Bucket[];
  topWords: WordFreq[];
  linesPerPoem: DistSummary;
  wordsPerPoem: DistSummary;
  wordsPerLine: DistSummary;
}

export { tokenizeWords as tokenize } from "./tokenize";

function linesOf(poem: Poem): string[] {
  return poem.content.split("\n").filter((l) => l.trim().length > 0);
}

function bucketize(
  values: number[],
  ranges: [number, number, string][],
): Bucket[] {
  return ranges.map(([from, to, label]) => ({
    range: label,
    count: values.filter((v) => v >= from && v < to).length,
  }));
}

/** Медиана. Для чётной длины — среднее двух центральных. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Мода. Возвращает самое частое значение и сколько раз оно встретилось.
 * При ничьей — побеждает меньшее значение (детерминированный выбор).
 */
function mode(values: number[]): { value: number; count: number } {
  if (values.length === 0) return { value: 0, count: 0 };
  const freq = new Map<number, number>();
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1);

  let bestValue = 0;
  let bestCount = 0;
  for (const [v, c] of [...freq.entries()].sort((a, b) => a[0] - b[0])) {
    if (c > bestCount) {
      bestValue = v;
      bestCount = c;
    }
  }
  return { value: bestValue, count: bestCount };
}

function summarize(values: number[]): DistSummary {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, mode: 0, modeCount: 0 };
  }
  const sum = values.reduce((s, v) => s + v, 0);
  const m = mode(values);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    mean: sum / values.length,
    median: median(values),
    mode: m.value,
    modeCount: m.count,
  };
}

export function computeStats(
  poems: Poem[],
  options: StatsOptions = {},
): CorpusStats {
  const stopwords = options.stopwords ?? new Set<string>();
  const topN = options.topN ?? 30;

  if (poems.length === 0) {
    const empty: DistSummary = {
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      mode: 0,
      modeCount: 0,
    };
    return {
      poemCount: 0,
      totalLines: 0,
      totalWords: 0,
      totalChars: 0,
      lineLengthDist: [],
      poemLengthDist: [],
      topWords: [],
      linesPerPoem: empty,
      wordsPerPoem: empty,
      wordsPerLine: empty,
    };
  }

  let totalLines = 0;
  let totalWords = 0;
  let totalChars = 0;

  const linesPerPoem: number[] = [];
  const wordsPerLine: number[] = [];
  const wordsPerPoem: number[] = [];
  const freq = new Map<string, number>();

  for (const p of poems) {
    const lines = linesOf(p);
    linesPerPoem.push(lines.length);
    totalLines += lines.length;
    totalChars += p.content.replace(/\s/g, "").length;

    let poemWordCount = 0;
    for (const line of lines) {
      const words = tokenizeWords(line);
      wordsPerLine.push(words.length);
      poemWordCount += words.length;
      totalWords += words.length;
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    wordsPerPoem.push(poemWordCount);
  }

  const topWords = [...freq.entries()]
    .filter(([w]) => w.length > 1 && !stopwords.has(w))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([word, count]) => ({ word, count }));

  return {
    poemCount: poems.length,
    totalLines,
    totalWords,
    totalChars,
    lineLengthDist: bucketize(wordsPerLine, [
      [1, 3, "1–2"],
      [3, 6, "3–5"],
      [6, 9, "6–8"],
      [9, 12, "9–11"],
      [12, 15, "12–14"],
      [15, Number.POSITIVE_INFINITY, "15+"],
    ]),
    poemLengthDist: bucketize(wordsPerPoem, [
      [0, 30, "до 30"],
      [30, 60, "30–59"],
      [60, 100, "60–99"],
      [100, 200, "100–199"],
      [200, 500, "200–499"],
      [500, Number.POSITIVE_INFINITY, "500+"],
    ]),
    topWords,
    linesPerPoem: summarize(linesPerPoem),
    wordsPerPoem: summarize(wordsPerPoem),
    wordsPerLine: summarize(wordsPerLine),
  };
}
