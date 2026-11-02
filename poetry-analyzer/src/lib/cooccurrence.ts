import type { Poem } from "../types";
import type { PoemAnalysis } from "./api";
import { posGroup } from "./pos";

export type WeightMode = "count" | "mi";

export interface CooccurrenceNode {
  id: string;
  freq: number;
}

export interface CooccurrenceEdge {
  source: string;
  target: string;
  weight: number;
}

export interface CooccurrenceGraph {
  nodes: CooccurrenceNode[];
  edges: CooccurrenceEdge[];
  coverage: { analyzed: number; total: number };
}

export interface PairStatsOptions {
  stopwords: Set<string>;
  posGroups?: Set<string>;
}

export interface PairStats {
  analyzed: number;
  total: number;
  /** Сколько раз лемма встретилась (токены). */
  lemmaFreq: Map<string, number>;
  /** В скольких стихах встретилась лемма. */
  lemmaDocs: Map<string, number>;
  /** В скольких стихах пара встретилась вместе. Ключ "a\tb", a < b. */
  pairDocs: Map<string, number>;
}

export function computePairStats(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  opts: PairStatsOptions,
): PairStats {
  const { stopwords, posGroups } = opts;
  const lemmaFreq = new Map<string, number>();
  const lemmaDocs = new Map<string, number>();
  const pairDocs = new Map<string, number>();
  let analyzed = 0;

  for (const poem of poems) {
    const a = analyses[poem.id];
    if (!a) continue;
    analyzed++;

    const inPoem = new Set<string>();
    for (const t of a.tokens) {
      const lemma = t.lemma;
      if (lemma.length <= 1 || stopwords.has(lemma)) continue;
      if (posGroups && posGroups.size > 0 && !posGroups.has(posGroup(t.pos)))
        continue;
      lemmaFreq.set(lemma, (lemmaFreq.get(lemma) ?? 0) + 1);
      inPoem.add(lemma);
    }

    const list = [...inPoem].sort();
    for (const lemma of list) {
      lemmaDocs.set(lemma, (lemmaDocs.get(lemma) ?? 0) + 1);
    }
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const key = `${list[i]}\t${list[j]}`;
        pairDocs.set(key, (pairDocs.get(key) ?? 0) + 1);
      }
    }
  }

  return { analyzed, total: poems.length, lemmaFreq, lemmaDocs, pairDocs };
}

/** MI по документам: log2( P(a∩b) / (P(a)·P(b)) ), вероятности — доли стихов. */
function pairMi(
  stats: PairStats,
  a: string,
  b: string,
  pairCount: number,
): number {
  const docsA = stats.lemmaDocs.get(a) ?? 0;
  const docsB = stats.lemmaDocs.get(b) ?? 0;
  if (docsA === 0 || docsB === 0 || stats.analyzed === 0) return 0;
  return Math.log2((pairCount * stats.analyzed) / (docsA * docsB));
}

function edgeWeight(
  stats: PairStats,
  a: string,
  b: string,
  pairCount: number,
  mode: WeightMode,
): number {
  return mode === "mi" ? pairMi(stats, a, b, pairCount) : pairCount;
}

export interface GraphOptions {
  topN: number;
  minWeight: number;
  weightMode: WeightMode;
  /** Максимум рёбер после фильтрации — чтобы граф оставался читаемым. */
  maxEdges?: number;
}

export function buildCooccurrenceGraph(
  stats: PairStats,
  opts: GraphOptions,
): CooccurrenceGraph {
  const { topN, minWeight, weightMode } = opts;
  const coverage = { analyzed: stats.analyzed, total: stats.total };

  const nodeIds = [...stats.lemmaFreq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([id]) => id);
  const nodeSet = new Set(nodeIds);

  const edges: CooccurrenceEdge[] = [];
  for (const [key, count] of stats.pairDocs.entries()) {
    const tab = key.indexOf("\t");
    const a = key.slice(0, tab);
    const b = key.slice(tab + 1);
    if (!nodeSet.has(a) || !nodeSet.has(b)) continue;
    const weight = edgeWeight(stats, a, b, count, weightMode);
    if (weight < minWeight) continue;
    edges.push({ source: a, target: b, weight });
  }
  edges.sort((x, y) => y.weight - x.weight);
  const maxEdges = opts.maxEdges ?? topN * 4;
  const kept = edges.slice(0, maxEdges);

  const connected = new Set<string>();
  for (const e of kept) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const nodes = nodeIds
    .filter((id) => connected.has(id))
    .map((id) => ({ id, freq: stats.lemmaFreq.get(id) ?? 0 }));

  return { nodes, edges: kept, coverage };
}

export interface FocusOptions {
  /** Сколько ближайших коллокатов показать. */
  topK: number;
  minWeight: number;
  /** По какой мере считать вес и сортировать соседей. */
  weightMode: WeightMode;
}

/** Эго-сеть: фокус-слово + его топ-K коллокатов (1 шаг). */
export function buildFocusGraph(
  stats: PairStats,
  focus: string,
  opts: FocusOptions,
): CooccurrenceGraph {
  const { topK, minWeight, weightMode } = opts;
  const coverage = { analyzed: stats.analyzed, total: stats.total };

  if (!stats.lemmaFreq.has(focus)) {
    return { nodes: [], edges: [], coverage };
  }

  const incident: CooccurrenceEdge[] = [];
  for (const [key, count] of stats.pairDocs.entries()) {
    const tab = key.indexOf("\t");
    const a = key.slice(0, tab);
    const b = key.slice(tab + 1);
    if (a !== focus && b !== focus) continue;
    const weight = edgeWeight(stats, a, b, count, weightMode);
    if (weight < minWeight) continue;
    incident.push({ source: a, target: b, weight });
  }
  incident.sort((x, y) => y.weight - x.weight);
  const edges = incident.slice(0, topK);

  // Фокус-узел добавляем всегда, даже если ни одна пара не прошла порог:
  // пользователь должен видеть, что лемма в корпусе есть, но связей нет.
  const nodes: CooccurrenceNode[] = [
    { id: focus, freq: stats.lemmaFreq.get(focus) ?? 0 },
  ];
  for (const e of edges) {
    const other = e.source === focus ? e.target : e.source;
    nodes.push({ id: other, freq: stats.lemmaFreq.get(other) ?? 0 });
  }

  return { nodes, edges, coverage };
}
