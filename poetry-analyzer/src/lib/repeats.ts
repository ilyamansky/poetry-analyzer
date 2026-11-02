// src/lib/repeats.ts
import type { Poem } from "../types";

export interface LineOccurrence {
  poemId: string;
  poemIndex: number;
  /** Первая непустая строка стиха — для контекста. */
  poemFirstLine: string;
  /** Номер строки в стихе (0-based). */
  lineIndex: number;
  originalLine: string;
}

export interface RepeatedLine {
  /** Оригинальный текст первого вхождения — для заголовка. */
  displayLine: string;
  normalized: string;
  occurrences: LineOccurrence[];
  /** Уникальных стихов в группе. */
  poemCount: number;
  /** Суммарно вхождений (может быть > poemCount при рефрене). */
  totalOccurrences: number;
  /** Есть ли повторы внутри одного стиха (рефрен). */
  hasInternalRepeat: boolean;
  /** Варианты нормализации в группе (только при includeNear). */
  variants: string[];
}

export interface RepeatsOptions {
  /** Минимальная длина нормализованной строки. Короче — выкидываем. */
  minLength?: number;
  /** Включать неточные совпадения (Levenshtein). */
  includeNear?: boolean;
  /** Максимальное расстояние Левенштейна. */
  maxLevenshtein?: number;
  /** Порог: не больше N уникальных строк для near-dup (защита от квадрата). */
  maxLinesForNear?: number;
}

const DEFAULT_MIN_LENGTH = 10;
const DEFAULT_MAX_LEV = 2;
const DEFAULT_MAX_LINES_FOR_NEAR = 20000;

/** Нормализация: нижний регистр, буквы/цифры/пробелы, схлопывание пробелов. */
function normalize(line: string): string {
  return line
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstNonEmptyLine(content: string): string {
  return (
    content
      .split(/\r?\n/)
      .find((l) => l.trim())
      ?.trim() ?? ""
  );
}

/** Левенштейн с ранним выходом по maxDist. */
function levenshtein(a: string, b: string, maxDist: number): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1;
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }
  return prev[n];
}

/** Union-find по числовым индексам. */
class UnionFind {
  private parent: number[] = [];
  private rank: number[] = [];

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }

  add(x: number) {
    while (this.parent.length <= x) {
      this.parent.push(this.parent.length);
      this.rank.push(0);
    }
  }
}

export function findRepeatedLines(
  poems: Poem[],
  options: RepeatsOptions = {},
): RepeatedLine[] {
  const minLength = options.minLength ?? DEFAULT_MIN_LENGTH;
  const includeNear = options.includeNear ?? false;
  const maxLev = options.maxLevenshtein ?? DEFAULT_MAX_LEV;
  const maxLinesForNear = options.maxLinesForNear ?? DEFAULT_MAX_LINES_FOR_NEAR;

  // 1. Раскладываем строки по нормализованным ключам (точные совпадения).
  const byNorm = new Map<string, LineOccurrence[]>();

  for (const poem of poems) {
    const lines = poem.content.split(/\r?\n/);
    const poemFirstLine = firstNonEmptyLine(poem.content);
    for (let i = 0; i < lines.length; i++) {
      const original = lines[i].trim();
      if (!original) continue;
      const normalized = normalize(original);
      if (normalized.length < minLength) continue;

      const occurrence: LineOccurrence = {
        poemId: poem.id,
        poemIndex: poem.index,
        poemFirstLine,
        lineIndex: i,
        originalLine: original,
      };
      const arr = byNorm.get(normalized);
      if (arr) arr.push(occurrence);
      else byNorm.set(normalized, [occurrence]);
    }
  }

  // 2. Кандидаты — уникальные нормализованные строки.
  const uniqNorm = [...byNorm.keys()];

  // 3. Группировка через union-find.
  //    - если includeNear = false — каждая uniqNorm в своей группе
  //    - если true — объединяем near-дубли
  const uf = new UnionFind();
  for (let i = 0; i < uniqNorm.length; i++) uf.add(i);

  if (includeNear && uniqNorm.length <= maxLinesForNear) {
    // Бакеты по длине — Levenshtein требует |len(a)-len(b)| ≤ maxLev.
    const byLength = new Map<number, number[]>();
    uniqNorm.forEach((s, i) => {
      const len = s.length;
      let arr = byLength.get(len);
      if (!arr) {
        arr = [];
        byLength.set(len, arr);
      }
      arr.push(i);
    });

    // Сравниваем внутри одной длины и между соседними длинами (d=1..maxLev).
    for (const [len, bucket] of byLength) {
      // Внутри одной длины
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = uniqNorm[bucket[i]];
          const b = uniqNorm[bucket[j]];
          if (levenshtein(a, b, maxLev) <= maxLev) {
            uf.union(bucket[i], bucket[j]);
          }
        }
      }
      // Между len и len+d
      for (let d = 1; d <= maxLev; d++) {
        const next = byLength.get(len + d);
        if (!next) continue;
        for (const i of bucket) {
          for (const j of next) {
            const a = uniqNorm[i];
            const b = uniqNorm[j];
            if (levenshtein(a, b, maxLev) <= maxLev) {
              uf.union(i, j);
            }
          }
        }
      }
    }
  }

  // 4. Собираем кластеры.
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < uniqNorm.length; i++) {
    const root = uf.find(i);
    const arr = clusters.get(root);
    if (arr) arr.push(i);
    else clusters.set(root, [i]);
  }

  // 5. Формируем RepeatedLine.
  const result: RepeatedLine[] = [];
  for (const indices of clusters.values()) {
    const occurrences: LineOccurrence[] = [];
    const variants: string[] = [];
    for (const idx of indices) {
      const norm = uniqNorm[idx];
      variants.push(norm);
      const occs = byNorm.get(norm);
      if (occs) occurrences.push(...occs);
    }

    if (occurrences.length < 2) continue;

    // Сортируем вхождения по (poemIndex, lineIndex)
    occurrences.sort(
      (a, b) => a.poemIndex - b.poemIndex || a.lineIndex - b.lineIndex,
    );

    const uniquePoems = new Set(occurrences.map((o) => o.poemId));
    const displayLine = occurrences[0].originalLine;

    result.push({
      displayLine,
      normalized: variants[0] ?? normalize(displayLine),
      occurrences,
      poemCount: uniquePoems.size,
      totalOccurrences: occurrences.length,
      hasInternalRepeat: occurrences.length > uniquePoems.size,
      variants: variants.sort((a, b) => a.localeCompare(b)),
    });
  }

  // 6. Сортировка: сначала те, что в большем числе стихов, потом по числу вхождений.
  result.sort((a, b) => {
    if (b.poemCount !== a.poemCount) return b.poemCount - a.poemCount;
    return b.totalOccurrences - a.totalOccurrences;
  });

  return result;
}
