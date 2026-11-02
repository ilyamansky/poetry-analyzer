import type { NamedCount } from "./aggregate";

export function mergeDistributions(
  a: NamedCount[],
  b: NamedCount[],
): { name: string; a: number; b: number }[] {
  const map = new Map<string, { name: string; a: number; b: number }>();

  for (const item of a) {
    map.set(item.name, { name: item.name, a: item.count, b: 0 });
  }
  for (const item of b) {
    const existing = map.get(item.name);
    if (existing) existing.b = item.count;
    else map.set(item.name, { name: item.name, a: 0, b: item.count });
  }

  return [...map.values()].sort(
    (x, y) => y.a + y.b - (x.a + x.b) || x.name.localeCompare(y.name),
  );
}

/** Нормализует значения к процентам от суммы по каждой серии. */
export function normalizeToPercent(
  data: { name: string; a: number; b: number }[],
): { name: string; a: number; b: number }[] {
  const totalA = data.reduce((s, x) => s + x.a, 0);
  const totalB = data.reduce((s, x) => s + x.b, 0);
  if (totalA === 0 && totalB === 0) return data;
  return data.map((x) => ({
    name: x.name,
    a: totalA ? (x.a / totalA) * 100 : 0,
    b: totalB ? (x.b / totalB) * 100 : 0,
  }));
}

/** Леммы, встречающиеся только в одной группе. */
export function uniqueLemmas(
  a: NamedCount[],
  b: NamedCount[],
): { onlyA: NamedCount[]; onlyB: NamedCount[] } {
  const setA = new Set(a.map((x) => x.name));
  const setB = new Set(b.map((x) => x.name));

  const onlyA = a
    .filter((x) => !setB.has(x.name))
    .sort((x, y) => y.count - x.count);
  const onlyB = b
    .filter((x) => !setA.has(x.name))
    .sort((x, y) => y.count - x.count);

  return { onlyA, onlyB };
}

// --- TF-IDF / log-odds ---

export interface LemmaScore {
  name: string;
  countA: number;
  countB: number;
  rateA: number; // доля в группе A (0..1)
  rateB: number; // доля в группе B (0..1)
  logOdds: number; // > 0 → чаще в A, < 0 → чаще в B
}

/**
 * Log-odds ratio со сглаживанием Лапласа.
 * Чем больше положительное число, тем специфичнее лемма для группы A.
 * Чем меньше (более отрицательное) — тем специфичнее для B.
 */
export function scoreLemmas(a: NamedCount[], b: NamedCount[]): LemmaScore[] {
  const map = new Map<string, { a: number; b: number }>();
  let totalA = 0;
  let totalB = 0;

  for (const x of a) {
    map.set(x.name, { a: x.count, b: 0 });
    totalA += x.count;
  }
  for (const x of b) {
    const cur = map.get(x.name);
    if (cur) cur.b = x.count;
    else map.set(x.name, { a: 0, b: x.count });
    totalB += x.count;
  }

  const V = map.size || 1;
  const alpha = 1; // сглаживание Лапласа

  const result: LemmaScore[] = [];
  for (const [name, { a: countA, b: countB }] of map.entries()) {
    const pA = (countA + alpha) / (totalA + alpha * V);
    const pB = (countB + alpha) / (totalB + alpha * V);
    result.push({
      name,
      countA,
      countB,
      rateA: totalA ? countA / totalA : 0,
      rateB: totalB ? countB / totalB : 0,
      logOdds: Math.log(pA / pB),
    });
  }

  return result;
}
