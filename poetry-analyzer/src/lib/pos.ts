// src/lib/pos.ts
import type { PoemAnalysis, TokenAnalysis } from "./api";

export const POS_GROUPS = [
  "существительное",
  "глагол",
  "прилагательное",
  "наречие",
  "причастие",
  "деепричастие",
  "числительное",
  "местоимение",
  "предлог",
  "союз",
  "частица",
  "междометие",
  "прочее",
] as const;

export type PosGroup = (typeof POS_GROUPS)[number];

const TAG_TO_GROUP: Record<string, PosGroup> = {
  NOUN: "существительное",
  VERB: "глагол",
  INFN: "глагол",
  ADJF: "прилагательное",
  ADJS: "прилагательное",
  ADVB: "наречие",
  PRTF: "причастие",
  PRTS: "причастие",
  GRND: "деепричастие",
  NUMR: "числительное",
  NPRO: "местоимение",
  PREP: "предлог",
  CONJ: "союз",
  PRCL: "частица",
  INTJ: "междометие",
};

export function posGroup(tag: string): PosGroup {
  return TAG_TO_GROUP[tag] ?? "прочее";
}

export function posName(tag: string): string {
  return posGroup(tag);
}

export function isPosGroup(value: string): value is PosGroup {
  return (POS_GROUPS as readonly string[]).includes(value);
}

export const POS_COLORS: Record<PosGroup, string> = {
  существительное: "#0f172a",
  глагол: "#b91c1c",
  прилагательное: "#1d4ed8",
  наречие: "#0e7490",
  причастие: "#7c3aed",
  деепричастие: "#a21caf",
  числительное: "#b45309",
  местоимение: "#4d7c0f",
  предлог: "#64748b",
  союз: "#94a3b8",
  частица: "#cbd5e1",
  междометие: "#e11d48",
  прочее: "#d6d3d1",
};

export function countByPosGroup(tokens: TokenAnalysis[]): Map<PosGroup, number> {
  const counts = new Map<PosGroup, number>();
  for (const t of tokens) {
    const g = posGroup(t.pos);
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  return counts;
}

export function dominantPos(analysis: PoemAnalysis): PosGroup | null {
  let best: PosGroup | null = null;
  let bestCount = 0;
  for (const [g, count] of countByPosGroup(analysis.tokens)) {
    if (count > bestCount) {
      best = g;
      bestCount = count;
    }
  }
  return best;
}

/** Отношение глаголов к существительным; null, если существительных нет. */
export function verbNounRatio(analysis: PoemAnalysis): number | null {
  let verbs = 0;
  let nouns = 0;
  for (const t of analysis.tokens) {
    const g = posGroup(t.pos);
    if (g === "глагол") verbs++;
    else if (g === "существительное") nouns++;
  }
  return nouns === 0 ? null : verbs / nouns;
}

export function countPosGroup(
  analysis: PoemAnalysis,
  group: PosGroup,
): number {
  let n = 0;
  for (const t of analysis.tokens) if (posGroup(t.pos) === group) n++;
  return n;
}

export function filterTokensByPos(
  analysis: PoemAnalysis,
  groups: Set<PosGroup>,
): TokenAnalysis[] {
  return analysis.tokens.filter((t) => groups.has(posGroup(t.pos)));
}
