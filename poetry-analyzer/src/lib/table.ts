// src/lib/table.ts
import type { PoemAnalysis } from "./api";
import { translateMeter } from "./api";
import { dominantPos, verbNounRatio, type PosGroup } from "./pos";
import { tokenizeWords } from "./tokenize";
import type { Poem } from "../types";

export interface TableRow {
  poem: Poem;
  index: number;
  linesCount: number;
  wordsCount: number;
  charsCount: number;
  meter: string | null; // переведённый человекочитаемый
  dominantPos: PosGroup | null;
  verbNounRatio: number | null;
  firstLine: string;
  analyzed: boolean;
}

export type SortKey = "index" | "lines" | "words" | "chars" | "meter";
export type SortDir = "asc" | "desc";

export interface TableFilters {
  meterKey: string; // 'all' | 'none' | <конкретный размер>
  linesMin: number | null;
  linesMax: number | null;
  wordsMin: number | null;
  wordsMax: number | null;
  query: string;
  lemma: string;
  /** 'all' | группа частей речи — фильтр по доминирующей части речи. */
  posGroup: string;
}

export function buildRows(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
): TableRow[] {
  return poems.map((poem) => {
    const lines = poem.content.split("\n").filter((l) => l.trim().length > 0);
    const words = tokenizeWords(poem.content);
    const a = analyses[poem.id];
    return {
      poem,
      index: poem.index,
      linesCount: lines.length,
      wordsCount: words.length,
      charsCount: poem.content.replace(/\s/g, "").length,
      meter: a ? translateMeter(a.meter) : null,
      dominantPos: a ? dominantPos(a) : null,
      verbNounRatio: a ? verbNounRatio(a) : null,
      firstLine: (lines[0] ?? "").slice(0, 120),
      analyzed: Boolean(a),
    };
  });
}

export function applyFilters(
  rows: TableRow[],
  filters: TableFilters,
  analyses: Record<string, PoemAnalysis>,
): TableRow[] {
  const lemmaNeedle = filters.lemma.trim();
  const queryNeedle = filters.query.trim().toLowerCase();

  return rows.filter((r) => {
    // Размер
    if (filters.meterKey !== "all") {
      if (filters.meterKey === "none") {
        if (r.meter) return false;
      } else if (r.meter !== filters.meterKey) {
        return false;
      }
    }

    // Диапазон строк
    if (filters.linesMin != null && r.linesCount < filters.linesMin)
      return false;
    if (filters.linesMax != null && r.linesCount > filters.linesMax)
      return false;

    // Диапазон слов
    if (filters.wordsMin != null && r.wordsCount < filters.wordsMin)
      return false;
    if (filters.wordsMax != null && r.wordsCount > filters.wordsMax)
      return false;

    // Поиск по тексту
    if (queryNeedle) {
      if (!r.poem.content.toLowerCase().includes(queryNeedle)) return false;
    }

    // Лемма
    if (lemmaNeedle) {
      const a = analyses[r.poem.id];
      if (!a) return false;
      const has = a.tokens.some((t) => t.lemma === lemmaNeedle);
      if (!has) return false;
    }

    // Доминирующая часть речи
    if (filters.posGroup !== "all" && r.dominantPos !== filters.posGroup) {
      return false;
    }

    return true;
  });
}

export function sortRows(
  rows: TableRow[],
  key: SortKey,
  dir: SortDir,
): TableRow[] {
  const sign = dir === "asc" ? 1 : -1;
  const sorted = [...rows];

  sorted.sort((x, y) => {
    // Не проанализированные всегда в конце, независимо от направления —
    // иначе "пустой размер" будет выше ямба при сортировке asc.
    if (key === "meter") {
      if (!x.meter && !y.meter) return x.index - y.index;
      if (!x.meter) return 1;
      if (!y.meter) return -1;
      return x.meter.localeCompare(y.meter, "ru") * sign;
    }

    let cmp = 0;
    switch (key) {
      case "index":
        cmp = x.index - y.index;
        break;
      case "lines":
        cmp = x.linesCount - y.linesCount;
        break;
      case "words":
        cmp = x.wordsCount - y.wordsCount;
        break;
      case "chars":
        cmp = x.charsCount - y.charsCount;
        break;
    }
    return cmp * sign;
  });

  return sorted;
}

/** Все встречающиеся размеры в наборе (для селектора). */
export function collectMeters(rows: TableRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) if (r.meter) set.add(r.meter);
  return [...set].sort((a, b) => a.localeCompare(b, "ru"));
}
