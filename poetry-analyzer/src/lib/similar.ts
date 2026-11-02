// src/lib/similar.ts
import type { Poem } from "../types";
import type { PoemAnalysis } from "./api";

export interface SimilarPoem {
  poem: Poem;
  /** Косинус TF-IDF, 0..1. */
  score: number;
  /** Топ общих значимых лемм (по вкладу в косинус). */
  sharedTerms: string[];
}

interface DocVector {
  weights: Map<string, number>;
  norm: number;
}

function buildVector(
  counts: Map<string, number>,
  idf: Map<string, number>,
): DocVector {
  const weights = new Map<string, number>();
  let sqSum = 0;
  for (const [lemma, count] of counts) {
    const idfVal = idf.get(lemma) ?? 0;
    // Sublinear tf: 1 + log(count) — частые слова не «съедают» редкие.
    const tf = 1 + Math.log(count);
    const w = tf * idfVal;
    weights.set(lemma, w);
    sqSum += w * w;
  }
  return { weights, norm: Math.sqrt(sqSum) };
}

export interface SimilarOptions {
  topN?: number;
  stopwords?: Set<string>;
  minScore?: number;
}

/**
 * Похожие стихи по лексике (TF-IDF + косинус).
 * Ищет внутри переданного набора `poems`, среди тех, у кого есть анализ.
 * Сам `targetPoemId` из результатов исключается.
 */
export function findSimilarPoems(
  targetPoemId: string,
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  options: SimilarOptions = {},
): SimilarPoem[] {
  const topN = options.topN ?? 8;
  const stopwords = options.stopwords ?? new Set<string>();
  const minScore = options.minScore ?? 0.05;

  // 1. Собираем «мешки лемм» по документам
  const docs: { poem: Poem; counts: Map<string, number> }[] = [];
  for (const poem of poems) {
    const a = analyses[poem.id];
    if (!a || a.tokens.length === 0) continue;
    const counts = new Map<string, number>();
    for (const t of a.tokens) {
      if (t.lemma.length <= 1) continue;
      if (stopwords.has(t.lemma)) continue;
      counts.set(t.lemma, (counts.get(t.lemma) ?? 0) + 1);
    }
    if (counts.size > 0) docs.push({ poem, counts });
  }

  const target = docs.find((d) => d.poem.id === targetPoemId);
  if (!target || docs.length < 2) return [];

  // 2. df и сглаженный idf
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const lemma of d.counts.keys()) {
      df.set(lemma, (df.get(lemma) ?? 0) + 1);
    }
  }
  const N = docs.length;
  const idf = new Map<string, number>();
  for (const [lemma, dfVal] of df) {
    idf.set(lemma, Math.log((N + 1) / (dfVal + 1)) + 1);
  }

  // 3. Векторы и косинус с целевым
  const targetVec = buildVector(target.counts, idf);
  if (targetVec.norm === 0) return [];

  const results: SimilarPoem[] = [];
  for (const d of docs) {
    if (d.poem.id === targetPoemId) continue;
    const v = buildVector(d.counts, idf);
    if (v.norm === 0) continue;

    // Обходим меньший вектор — эффективнее по памяти
    const [small, large] =
      targetVec.weights.size <= v.weights.size
        ? [targetVec.weights, v.weights]
        : [v.weights, targetVec.weights];

    let dot = 0;
    const contributions: { lemma: string; score: number }[] = [];
    for (const [lemma, w] of small) {
      const otherW = large.get(lemma);
      if (otherW == null) continue;
      const product = w * otherW;
      dot += product;
      contributions.push({ lemma, score: product });
    }

    const score = dot / (targetVec.norm * v.norm);
    if (score < minScore) continue;

    contributions.sort((a, b) => b.score - a.score);
    const sharedTerms = contributions.slice(0, 5).map((c) => c.lemma);

    results.push({ poem: d.poem, score, sharedTerms });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}

export function firstLine(poem: Poem): string {
  const line = poem.content.split(/\r?\n/).find((l) => l.trim());
  return line?.trim() ?? "";
}
