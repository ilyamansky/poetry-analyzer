// src/lib/networkMetrics.ts
import Graph from "graphology";
import betweenness from "graphology-metrics/centrality/betweenness";
import pagerank from "graphology-metrics/centrality/pagerank";
import louvain from "graphology-communities-louvain";
import type { CooccurrenceGraph } from "./cooccurrence";

export interface NodeMetrics {
  id: string;
  freq: number;
  degree: number;
  weightedDegree: number;
  betweenness: number;
  pagerank: number;
  /** Условный номер сообщества: 0 — самое большое, дальше по убыванию. */
  community: number;
}

export interface NetworkMetrics {
  nodes: NodeMetrics[];
  byId: Map<string, NodeMetrics>;
  /** Сколько сообществ найдено (Louvain). */
  communityCount: number;
  maxDegree: number;
  maxBetweenness: number;
  maxPageRank: number;
  maxFreq: number;
}

const EMPTY: NetworkMetrics = {
  nodes: [],
  byId: new Map(),
  communityCount: 0,
  maxDegree: 0,
  maxBetweenness: 0,
  maxPageRank: 0,
  maxFreq: 0,
};

export function computeNetworkMetrics(
  graph: CooccurrenceGraph,
): NetworkMetrics {
  if (graph.nodes.length === 0) return EMPTY;

  const g = new Graph({ multi: false, type: "undirected" });
  for (const n of graph.nodes) g.addNode(n.id, { freq: n.freq });
  for (const e of graph.edges) {
    if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue;
    if (g.hasEdge(e.source, e.target)) continue;
    g.addEdge(e.source, e.target, { weight: e.weight });
  }

  // Степени
  const degree = new Map<string, number>();
  const weightedDegree = new Map<string, number>();
  g.forEachNode((id) => {
    degree.set(id, g.degree(id));
    let w = 0;
    g.forEachEdge(id, (_, attrs) => {
      w += attrs.weight ?? 1;
    });
    weightedDegree.set(id, w);
  });

  // Betweenness (normalized → значения в [0,1])
  const bw = betweenness(g, { normalized: true });

  // PageRank с весами рёбер
  const pr = pagerank(g, {
    getEdgeWeight: "weight",
    alpha: 0.85,
    maxIterations: 100,
    tolerance: 0.0001,
  });

  // Louvain: nodeId → communityId (произвольный)
  const rawComm = louvain(g, {
    getEdgeWeight: "weight",
    resolution: 1,
  });

  // Сортируем сообщества по размеру: самое большое = 0, дальше по убыванию.
  // Так цвета стабильны между запусками, даже если Louvain нумерует иначе.
  const sizes = new Map<number, number>();
  for (const id of Object.keys(rawComm)) {
    const c = rawComm[id];
    sizes.set(c, (sizes.get(c) ?? 0) + 1);
  }
  const sorted = [...sizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  const remap = new Map<number, number>();
  sorted.forEach((c, i) => remap.set(c, i));

  const nodes: NodeMetrics[] = [];
  g.forEachNode((id) => {
    const attrs = g.getNodeAttributes(id);
    nodes.push({
      id,
      freq: attrs.freq ?? 0,
      degree: degree.get(id) ?? 0,
      weightedDegree: weightedDegree.get(id) ?? 0,
      betweenness: bw[id] ?? 0,
      pagerank: pr[id] ?? 0,
      community: remap.get(rawComm[id]) ?? 0,
    });
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return {
    nodes,
    byId,
    communityCount: sorted.length,
    maxDegree: Math.max(0, ...nodes.map((n) => n.degree)),
    maxBetweenness: Math.max(0, ...nodes.map((n) => n.betweenness)),
    maxPageRank: Math.max(0, ...nodes.map((n) => n.pagerank)),
    maxFreq: Math.max(1, ...nodes.map((n) => n.freq)),
  };
}

/**
 * Палитра для сообществ. ColorBrewer Dark2 (8 цветов) — различима,
 * не сливается с фокус-красным. Если сообществ больше 8 — циклически
 * повторяем с чуть сдвинутым оттенком (упрощённо — просто повтор).
 */
export const COMMUNITY_COLORS = [
  "#1b9e77",
  "#d95f02",
  "#7570b3",
  "#e7298a",
  "#66a61e",
  "#e6ab02",
  "#a6761d",
  "#666666",
];

export function communityColor(community: number): string {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}
