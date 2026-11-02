// src/lib/concordance.ts
import type { PoemAnalysis } from "./api";
import { posGroup } from "./pos";
import { tokenizeWithPositions } from "./tokenize";
import type { Poem } from "../types";

export type ConcordanceMode = "lemma" | "word" | "substring";
export type ConcordanceSort = "position" | "left" | "right" | "kw";

export interface ConcordanceHit {
  poemId: string;
  poemIndex: number;
  lineIndex: number;
  lineNumber: number;
  /** Предыдущие строки в естественном порядке (ближняя — последняя). */
  prevLines: string[];
  /** Часть текущей строки до ключа, обрезанная по width. */
  left: string;
  /** Ключ, как он выглядит в тексте. */
  kw: string;
  /** Часть текущей строки после ключа. */
  right: string;
  /** Следующие строки в естественном порядке. */
  nextLines: string[];
  /** Леммы/формы слева от ключа, до `window` токенов (сквозь строки). */
  leftTokens: string[];
  /** Леммы/формы справа от ключа. */
  rightTokens: string[];
}

interface TokenWithPos {
  form: string;
  lower: string;
  lemma: string;
  start: number;
  end: number;
}

interface BuildOptions {
  poems: Poem[];
  analyses: Record<string, PoemAnalysis>;
  query: string;
  mode: ConcordanceMode;
  width: number;
  window: number;
  lineContext: number;
  /** Группы частей речи; совпадение засчитывается, только если токен входит в одну из них. */
  posFilter?: Set<string>;
}

function buildLemmaMap(
  analysis: PoemAnalysis | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  if (analysis) {
    for (const t of analysis.tokens) m.set(t.original.toLowerCase(), t.lemma);
  }
  return m;
}

function tokenizeLine(
  line: string,
  lemmaByForm: Map<string, string>,
): TokenWithPos[] {
  return tokenizeWithPositions(line).map((t) => ({
    form: t.form,
    lower: t.word,
    lemma: lemmaByForm.get(t.word) ?? t.word,
    start: t.position,
    end: t.position + t.form.length,
  }));
}

export function buildConcordance(opts: BuildOptions): ConcordanceHit[] {
  const {
    poems,
    analyses,
    query,
    mode,
    width,
    window: win,
    lineContext,
    posFilter,
  } = opts;
  const needle = query.trim();
  if (!needle) return [];

  // В режиме подстроки токен не выделяется, поэтому фильтр по части речи не применяется.
  const posGroups = posFilter ?? new Set<string>();
  const posActive = posGroups.size > 0 && mode !== "substring";

  const lowerNeedle = needle.toLowerCase();
  const hits: ConcordanceHit[] = [];

  for (const poem of poems) {
    const analysis = analyses[poem.id];
    if ((mode === "lemma" || posActive) && !analysis) continue;

    const lemmaByForm = buildLemmaMap(analysis);

    // Для режима lemma — карта «форма → множество лемм»
    const formToLemmas = new Map<string, Set<string>>();
    if (mode === "lemma" && analysis) {
      for (const t of analysis.tokens) {
        const form = t.original.toLowerCase();
        let set = formToLemmas.get(form);
        if (!set) {
          set = new Set();
          formToLemmas.set(form, set);
        }
        set.add(t.lemma);
      }
    }

    // Карты «форма → группы частей речи» и «форма+лемма → группы» для POS-фильтра.
    // Омонимичные формы объединяются: совпадение засчитывается, если хотя бы один
    // разбор формы попадает в выбранные группы.
    const formGroups = new Map<string, Set<string>>();
    const pairGroups = new Map<string, Set<string>>();
    if (analysis && posActive) {
      for (const t of analysis.tokens) {
        const form = t.original.toLowerCase();
        const g = posGroup(t.pos);
        let fs = formGroups.get(form);
        if (!fs) {
          fs = new Set();
          formGroups.set(form, fs);
        }
        fs.add(g);
        const pairKey = `${form}\t${t.lemma}`;
        let ps = pairGroups.get(pairKey);
        if (!ps) {
          ps = new Set();
          pairGroups.set(pairKey, ps);
        }
        ps.add(g);
      }
    }

    const matchesPos = (form: string, lemma?: string): boolean => {
      if (!posActive) return true;
      const set =
        lemma !== undefined
          ? pairGroups.get(`${form}\t${lemma}`)
          : formGroups.get(form);
      if (!set) return false;
      for (const g of set) if (posGroups.has(g)) return true;
      return false;
    };

    const lines = poem.content.split("\n");

    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      if (!line.trim()) continue;

      const lineTokens = tokenizeLine(line, lemmaByForm);
      const matches: { start: number; length: number }[] = [];

      if (mode === "substring") {
        const lowerLine = line.toLowerCase();
        let from = 0;
        while (true) {
          const idx = lowerLine.indexOf(lowerNeedle, from);
          if (idx === -1) break;
          matches.push({ start: idx, length: needle.length });
          from = idx + needle.length;
        }
      } else {
        for (const t of lineTokens) {
          const ok =
            mode === "word"
              ? t.lower === lowerNeedle && matchesPos(t.lower)
              : (formToLemmas.get(t.lower)?.has(needle) ?? false) &&
                matchesPos(t.lower, needle);
          if (ok) matches.push({ start: t.start, length: t.form.length });
        }
      }

      for (const m of matches) {
        hits.push(
          makeHit({
            poem,
            lines,
            lineIndex: li,
            line,
            lineTokens,
            matchStart: m.start,
            matchLen: m.length,
            width,
            window: win,
            lineContext,
            lemmaByForm,
          }),
        );
      }
    }
  }

  return hits;
}

interface MakeHitArgs {
  poem: Poem;
  lines: string[];
  lineIndex: number;
  line: string;
  lineTokens: TokenWithPos[];
  matchStart: number;
  matchLen: number;
  width: number;
  window: number;
  lineContext: number;
  lemmaByForm: Map<string, string>;
}

function makeHit(args: MakeHitArgs): ConcordanceHit {
  const {
    poem,
    lines,
    lineIndex,
    line,
    lineTokens,
    matchStart,
    matchLen,
    width,
    window: win,
    lineContext,
    lemmaByForm,
  } = args;

  const matchEnd = matchStart + matchLen;

  // --- Отображение контекста строки ---
  const leftStart = Math.max(0, matchStart - width);
  const rightEnd = Math.min(line.length, matchEnd + width);
  const rawLeft = line.slice(leftStart, matchStart);
  const rawRight = line.slice(matchEnd, rightEnd);

  // --- Соседние строки для отображения ---
  const prevLines: string[] = [];
  if (lineContext > 0) {
    for (let i = Math.max(0, lineIndex - lineContext); i < lineIndex; i++) {
      if (lines[i].trim()) prevLines.push(lines[i]);
    }
  }
  const nextLines: string[] = [];
  if (lineContext > 0) {
    for (
      let i = lineIndex + 1;
      i <= Math.min(lines.length - 1, lineIndex + lineContext);
      i++
    ) {
      if (lines[i].trim()) nextLines.push(lines[i]);
    }
  }

  // --- Токены для коллокаций (сквозь строки) ---
  const beforeTokens: TokenWithPos[] = [];
  if (lineContext > 0) {
    for (let i = Math.max(0, lineIndex - lineContext); i < lineIndex; i++) {
      if (lines[i].trim())
        beforeTokens.push(...tokenizeLine(lines[i], lemmaByForm));
    }
  }

  // Индекс ключа в «ленте» токенов
  let keyIdx = -1;
  // Сначала пытаемся найти точное совпадение начала
  for (let i = 0; i < lineTokens.length; i++) {
    if (lineTokens[i].start === matchStart) {
      keyIdx = beforeTokens.length + i;
      break;
    }
  }
  // Fallback: ближайший токен справа от начала совпадения
  if (keyIdx === -1) {
    for (let i = 0; i < lineTokens.length; i++) {
      if (lineTokens[i].start >= matchStart) {
        keyIdx = beforeTokens.length + i;
        break;
      }
    }
    if (keyIdx === -1 && lineTokens.length > 0) {
      keyIdx = beforeTokens.length + lineTokens.length - 1;
    }
  }

  const afterTokens: TokenWithPos[] = [];
  if (lineContext > 0) {
    for (
      let i = lineIndex + 1;
      i <= Math.min(lines.length - 1, lineIndex + lineContext);
      i++
    ) {
      if (lines[i].trim())
        afterTokens.push(...tokenizeLine(lines[i], lemmaByForm));
    }
  }

  const allTokens = [...beforeTokens, ...lineTokens, ...afterTokens];

  const leftTokens =
    keyIdx >= 0
      ? allTokens.slice(Math.max(0, keyIdx - win), keyIdx).map((t) => t.lemma)
      : [];
  const rightTokens =
    keyIdx >= 0
      ? allTokens.slice(keyIdx + 1, keyIdx + 1 + win).map((t) => t.lemma)
      : [];

  return {
    poemId: poem.id,
    poemIndex: poem.index,
    lineIndex,
    lineNumber: lineIndex + 1,
    prevLines,
    left: (leftStart > 0 ? "…" : "") + rawLeft,
    kw: line.slice(matchStart, matchEnd),
    right: rawRight + (rightEnd < line.length ? "…" : ""),
    nextLines,
    leftTokens,
    rightTokens,
  };
}

export function sortConcordance<T extends ConcordanceHit>(
  hits: T[],
  sort: ConcordanceSort,
): T[] {
  const arr = [...hits];
  switch (sort) {
    case "left":
      arr.sort((a, b) => a.left.localeCompare(b.left, "ru"));
      break;
    case "right":
      arr.sort((a, b) => a.right.localeCompare(b.right, "ru"));
      break;
    case "kw":
      arr.sort((a, b) => a.kw.localeCompare(b.kw, "ru"));
      break;
    case "position":
    default:
      break;
  }
  return arr;
}

// --- Коллокации (без изменений) ---

export interface CollocationEntry {
  lemma: string;
  freq: number;
  docs: number;
  mi: number;
}

interface ComputeOptions {
  stopwords: Set<string>;
  excludeLemmas: Set<string>;
  minFreq?: number;
}

export function computeCollocations(
  hits: ConcordanceHit[],
  poems: Poem[],
  analyses: Record<string, PoemAnalysis>,
  opts: ComputeOptions,
): CollocationEntry[] {
  const { stopwords, excludeLemmas, minFreq = 2 } = opts;

  const windowFreq = new Map<string, number>();
  const windowDocs = new Map<string, Set<string>>();
  let totalWindowTokens = 0;

  for (const h of hits) {
    const tokens = [...h.leftTokens, ...h.rightTokens];
    for (const lemma of tokens) {
      totalWindowTokens++;
      windowFreq.set(lemma, (windowFreq.get(lemma) ?? 0) + 1);
      let docs = windowDocs.get(lemma);
      if (!docs) {
        docs = new Set();
        windowDocs.set(lemma, docs);
      }
      docs.add(h.poemId);
    }
  }

  if (totalWindowTokens === 0) return [];

  const corpusFreq = new Map<string, number>();
  let totalCorpusTokens = 0;
  for (const p of poems) {
    const a = analyses[p.id];
    if (!a) continue;
    for (const t of a.tokens) {
      totalCorpusTokens++;
      corpusFreq.set(t.lemma, (corpusFreq.get(t.lemma) ?? 0) + 1);
    }
  }

  const hasCorpusFreq = totalCorpusTokens > 0;

  const entries: CollocationEntry[] = [];
  for (const [lemma, freq] of windowFreq.entries()) {
    if (freq < minFreq) continue;
    if (stopwords.has(lemma)) continue;
    if (excludeLemmas.has(lemma)) continue;

    const pKey = freq / totalWindowTokens;
    const pCorpus = hasCorpusFreq
      ? (corpusFreq.get(lemma) ?? 0) / totalCorpusTokens
      : 0;
    const mi = hasCorpusFreq && pCorpus > 0 ? Math.log2(pKey / pCorpus) : 0;

    entries.push({
      lemma,
      freq,
      docs: windowDocs.get(lemma)?.size ?? 0,
      mi,
    });
  }

  return entries;
}
