// src/lib/rhyme.ts
import type { Poem } from "../types";
import type { PoemAnalysis } from "./api";

export type SchemeType =
  | "перекрёстная"
  | "парная"
  | "охватная"
  | "холостая"
  | "монорим"
  | "смешанная"
  | "белый стих";

export const SCHEME_ORDER: SchemeType[] = [
  "перекрёстная",
  "парная",
  "охватная",
  "холостая",
  "монорим",
  "смешанная",
  "белый стих",
];

/**
 * Классификация схемы рифмовки.
 *
 * Поддерживает "-" как позицию без рифмы (холостая схема "A-A-").
 * AAAA и длиннее остаётся "моноримом" — если RPST не различил рифмы
 * и свёл всё в одну группу, это его решение, а не наша ошибка.
 */
export function classifyScheme(scheme: string | null): SchemeType | null {
  if (!scheme) return null;
  const s = scheme.toUpperCase();
  if (!/[A-Z]/.test(s)) return null;

  // Холостая: в 4-строчной строфе рифмуются только чётные или только
  // нечётные строки.
  if (s.length === 4) {
    const rhymed = s.split("").map((c) => /[A-Z]/.test(c));
    if (rhymed[0] && rhymed[2] && !rhymed[1] && !rhymed[3] && s[0] === s[2])
      return "холостая";
    if (rhymed[1] && rhymed[3] && !rhymed[0] && !rhymed[2] && s[1] === s[3])
      return "холостая";
  }

  // Нормализация: "-" заменяем на уникальную букву, не занятую
  // настоящими рифмами.
  const used = new Set<string>();
  for (const c of s) if (/[A-Z]/.test(c)) used.add(c);

  let nextCode = 65;
  const makePlaceholder = (): string => {
    while (used.has(String.fromCharCode(nextCode))) nextCode++;
    const p = String.fromCharCode(nextCode++);
    used.add(p);
    return p;
  };

  const normalized = s
    .split("")
    .map((c) => (/[A-Z]/.test(c) ? c : makePlaceholder()))
    .join("");

  if (normalized.length >= 2 && new Set(normalized).size === normalized.length)
    return "белый стих";
  if (new Set(normalized).size === 1) return "монорим";

  if (normalized.length >= 4 && normalized.length % 2 === 0) {
    let ok = true;
    for (let i = 0; i + 2 < normalized.length; i++) {
      if (normalized[i] !== normalized[i + 2]) {
        ok = false;
        break;
      }
    }
    if (ok) return "перекрёстная";
  }

  if (normalized.length >= 4 && normalized.length % 2 === 0) {
    let ok = true;
    for (let i = 0; i + 1 < normalized.length; i += 2) {
      if (normalized[i] !== normalized[i + 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return "парная";
  }

  if (normalized.length >= 4 && normalized.length % 4 === 0) {
    let ok = true;
    for (let i = 0; i + 4 <= normalized.length; i += 4) {
      if (
        normalized[i] !== normalized[i + 3] ||
        normalized[i + 1] !== normalized[i + 2]
      ) {
        ok = false;
        break;
      }
    }
    if (ok) return "охватная";
  }

  return "смешанная";
}

export function describeRhyme(scheme: string | null): {
  raw: string | null;
  human: string | null;
} {
  if (!scheme) return { raw: null, human: null };
  const type = classifyScheme(scheme);
  if (!type) return { raw: null, human: null };
  return { raw: scheme, human: type };
}

export interface RhymeGroup {
  letter: string;
  words: string[];
  lineIndices: number[];
}

function extractLastWord(line: string): string | null {
  const words = line
    .toLowerCase()
    .replace(/[^\p{L}\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  return words[words.length - 1];
}

export function extractRhymeGroups(poem: Poem, scheme: string): RhymeGroup[] {
  const s = scheme.toUpperCase();
  if (!s) return [];

  const lines = poem.content.split(/\r?\n/).filter((l) => l.trim());
  const n = Math.min(lines.length, s.length);
  if (n === 0) return [];

  const groups = new Map<string, { words: string[]; lineIndices: number[] }>();
  for (let i = 0; i < n; i++) {
    const letter = s[i];
    if (!/[A-Z]/.test(letter)) continue;
    const lastWord = extractLastWord(lines[i]);
    if (!lastWord) continue;

    if (!groups.has(letter)) groups.set(letter, { words: [], lineIndices: [] });
    const g = groups.get(letter)!;
    g.words.push(lastWord);
    g.lineIndices.push(i);
  }

  return [...groups.entries()]
    .map(([letter, data]) => ({ letter, ...data }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
}

export interface RhymeDictionary {
  entries: Map<string, Map<string, number>>;
  frequencies: Map<string, number>;
}

export function buildRhymeDictionary(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
): RhymeDictionary {
  const entries = new Map<string, Map<string, number>>();
  const frequencies = new Map<string, number>();

  for (const poem of poems) {
    const scheme = analyses[poem.id]?.rhymeScheme;
    if (!scheme) continue;

    const groups = extractRhymeGroups(poem, scheme);
    for (const group of groups) {
      for (let i = 0; i < group.words.length; i++) {
        for (let j = i + 1; j < group.words.length; j++) {
          const a = group.words[i];
          const b = group.words[j];
          if (a === b) continue;

          if (!entries.has(a)) entries.set(a, new Map());
          if (!entries.has(b)) entries.set(b, new Map());
          entries.get(a)!.set(b, (entries.get(a)!.get(b) ?? 0) + 1);
          entries.get(b)!.set(a, (entries.get(b)!.get(a) ?? 0) + 1);
          frequencies.set(a, (frequencies.get(a) ?? 0) + 1);
          frequencies.set(b, (frequencies.get(b) ?? 0) + 1);
        }
      }
    }
  }

  return { entries, frequencies };
}

export interface SchemeDistribution {
  type: SchemeType;
  count: number;
}

export interface RhymePoemEntry {
  poem: Poem;
  scheme: string;
  type: SchemeType;
}

export interface RhymeCorpus {
  analyzed: number;
  total: number;
  distribution: SchemeDistribution[];
  dictionary: RhymeDictionary;
  poems: RhymePoemEntry[];
}

export function buildRhymeCorpus(
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
): RhymeCorpus {
  const distribution = new Map<SchemeType, number>();
  const poemEntries: RhymePoemEntry[] = [];
  let analyzed = 0;

  for (const poem of poems) {
    const scheme = analyses[poem.id]?.rhymeScheme;
    if (!scheme) continue;
    const type = classifyScheme(scheme);
    if (!type) continue;

    analyzed++;
    distribution.set(type, (distribution.get(type) ?? 0) + 1);
    poemEntries.push({ poem, scheme, type });
  }

  return {
    analyzed,
    total: poems.length,
    distribution: SCHEME_ORDER.filter((t) => distribution.has(t)).map(
      (type) => ({ type, count: distribution.get(type)! }),
    ),
    dictionary: buildRhymeDictionary(poems, analyses),
    poems: poemEntries,
  };
}
