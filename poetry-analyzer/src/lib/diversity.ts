import type { Poem } from "../types";
import { tokenizeWords } from "./tokenize";

export interface DiversityStats {
  totalTokens: number;
  uniqueTokens: number;
  /** Type-token ratio: уникальные / все. */
  ttr: number;
  /** Moving-average TTR с окном 50; null, если токенов меньше окна. */
  mattr: number | null;
  hapaxCount: number;
  /** Доля хапаксов среди уникальных слов, в процентах. */
  hapaxPercent: number;
  /** Средняя длина слова в знаках. */
  meanWordLength: number;
  /** Среднее число слов в строке. */
  meanLineLength: number;
  /** Среднее число слов в стихотворении. */
  meanPoemLength: number;
}

export const MATTR_WINDOW = 50;

export function computeDiversity(poems: Poem[]): DiversityStats {
  const tokens: string[] = [];
  const lineLengths: number[] = [];
  const poemLengths: number[] = [];

  for (const p of poems) {
    const lines = p.content.split("\n").filter((l) => l.trim().length > 0);
    let poemWords = 0;
    for (const line of lines) {
      const words = tokenizeWords(line);
      lineLengths.push(words.length);
      poemWords += words.length;
      for (const w of words) tokens.push(w);
    }
    poemLengths.push(poemWords);
  }

  const freq = new Map<string, number>();
  let charTotal = 0;
  for (const t of tokens) {
    freq.set(t, (freq.get(t) ?? 0) + 1);
    charTotal += t.length;
  }

  const total = tokens.length;
  const unique = freq.size;
  let hapax = 0;
  for (const c of freq.values()) if (c === 1) hapax++;

  let mattr: number | null = null;
  if (total >= MATTR_WINDOW) {
    let sum = 0;
    let windows = 0;
    const windowFreq = new Map<string, number>();
    for (let i = 0; i < total; i++) {
      windowFreq.set(tokens[i], (windowFreq.get(tokens[i]) ?? 0) + 1);
      if (i >= MATTR_WINDOW) {
        const out = tokens[i - MATTR_WINDOW];
        const left = (windowFreq.get(out) ?? 1) - 1;
        if (left === 0) windowFreq.delete(out);
        else windowFreq.set(out, left);
      }
      if (i >= MATTR_WINDOW - 1) {
        sum += windowFreq.size / MATTR_WINDOW;
        windows++;
      }
    }
    mattr = windows > 0 ? sum / windows : null;
  }

  const mean = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

  return {
    totalTokens: total,
    uniqueTokens: unique,
    ttr: total === 0 ? 0 : unique / total,
    mattr,
    hapaxCount: hapax,
    hapaxPercent: unique === 0 ? 0 : (hapax / unique) * 100,
    meanWordLength: total === 0 ? 0 : charTotal / total,
    meanLineLength: mean(lineLengths),
    meanPoemLength: mean(poemLengths),
  };
}
