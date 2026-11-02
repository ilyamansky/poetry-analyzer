import type { Poem } from "../types";
import type { PoemAnalysis } from "./api";
import { posGroup } from "./pos";
import { tokenizeWords } from "./tokenize";

export interface NgramOptions {
  n: 2 | 3;
  stopwords: Set<string>;
  /** false — пропускать n-граммы, содержащие стоп-слова. */
  includeStopwords: boolean;
  /**
   * Паттерн групп частей речи по позициям (null — любая).
   * Требует анализов; без них результат пуст, см. analyzed.
   */
  posPattern?: (string | null)[] | null;
}

export interface NgramRow {
  ngram: string;
  count: number;
}

export interface NgramResult {
  rows: NgramRow[];
  /** Токенов в обработанных стихах — база для «на 100 тыс. слов». */
  totalTokens: number;
  /** Сколько стихов реально обработано (с POS-паттерном — только с анализом). */
  analyzed: number;
}

export function computeNgrams(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  opts: NgramOptions,
): NgramResult {
  const { n, stopwords, includeStopwords, posPattern } = opts;
  const patternActive = posPattern != null && posPattern.some((g) => g != null);

  const counts = new Map<string, number>();
  let totalTokens = 0;
  let analyzed = 0;

  for (const poem of poems) {
    if (patternActive) {
      const a = analyses[poem.id];
      if (!a) continue;
      analyzed++;
      const tokens = a.tokens.map((t) => ({
        w: t.original.toLowerCase(),
        g: posGroup(t.pos),
      }));
      totalTokens += tokens.length;
      for (let i = 0; i + n <= tokens.length; i++) {
        const slice = tokens.slice(i, i + n);
        if (
          posPattern!.some(
            (g, j) => g != null && slice[j] && slice[j].g !== g,
          )
        )
          continue;
        const key = slice.map((t) => t.w).join(" ");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    } else {
      analyzed++;
      const words = tokenizeWords(poem.content);
      totalTokens += words.length;
      for (let i = 0; i + n <= words.length; i++) {
        const slice = words.slice(i, i + n);
        if (!includeStopwords && slice.some((w) => stopwords.has(w))) continue;
        const key = slice.join(" ");
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }

  const rows = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([ngram, count]) => ({ ngram, count }));

  return { rows, totalTokens, analyzed };
}
