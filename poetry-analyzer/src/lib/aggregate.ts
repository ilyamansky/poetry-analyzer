// src/lib/aggregate.ts
import type { Poem } from "../types";
import type { PoemAnalysis } from "./api";
import { isFullAnalysis, translateMeter } from "./api";
import { posGroup } from "./pos";

export interface NamedCount {
  name: string;
  count: number;
}

export interface AggregateStats {
  analyzedCount: number;
  totalCount: number;
  meterDist: NamedCount[];
  posDist: NamedCount[];
  topLemmas: NamedCount[];
  allLemmas: NamedCount[];
}

const CONTENT_POS = new Set([
  "NOUN",
  "ADJF",
  "ADJS",
  "VERB",
  "INFN",
  "PRTF",
  "PRTS",
  "GRND",
  "ADVB",
  "NUMR",
]);

export interface AggregateOptions {
  stopwords?: Set<string>;
  topN?: number;
}

export function aggregateAnalyses(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  options: AggregateOptions = {},
): AggregateStats {
  const stopwords = options.stopwords ?? new Set<string>();
  const topN = options.topN ?? 30;

  const meterCounts = new Map<string, number>();
  const posCounts = new Map<string, number>();
  const lemmaCounts = new Map<string, number>();
  let analyzedCount = 0;

  for (const poem of poems) {
    const a = analyses[poem.id];
    if (!a) continue;
    analyzedCount++;

    const meterName = translateMeter(a.meter) ?? "не определён";
    meterCounts.set(meterName, (meterCounts.get(meterName) ?? 0) + 1);

    // isFullAnalysis больше не используется для распределения рифмы
    // и уверенности, но нужен в других местах — оставляем импорт.
    void isFullAnalysis;

    for (const t of a.tokens) {
      const g = posGroup(t.pos);
      posCounts.set(g, (posCounts.get(g) ?? 0) + 1);

      if (
        CONTENT_POS.has(t.pos) &&
        t.lemma.length > 1 &&
        !stopwords.has(t.lemma)
      ) {
        lemmaCounts.set(t.lemma, (lemmaCounts.get(t.lemma) ?? 0) + 1);
      }
    }
  }

  const meterDist = [...meterCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const posDist = [...posCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const allLemmas = [...lemmaCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));

  const topLemmas = allLemmas.slice(0, topN);

  return {
    analyzedCount,
    totalCount: poems.length,
    meterDist,
    posDist,
    topLemmas,
    allLemmas,
  };
}
