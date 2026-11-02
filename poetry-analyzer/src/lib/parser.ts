import type { Poem } from "../types";

/* Строка, состоящая только из 3+ звёздочек (возможно, с пробелами). */
const STAR_LINE = /^\s*\*{3,}\s*$/;

/* ============================================================
 * parsePoemsDetailed — основная логика нарезки текста на стихи.
 * Возвращает сами стихи + диагностику для UploadPage.
 * ============================================================ */
export interface ParseResult {
  poems: Poem[];
  hasSeparator: boolean;
  maxChunkLength: number;
  totalLength: number;
}

export function parsePoemsDetailed(raw: string): ParseResult {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) {
    return {
      poems: [],
      hasSeparator: false,
      maxChunkLength: 0,
      totalLength: 0,
    };
  }

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];
  let separatorCount = 0;

  for (const line of lines) {
    if (STAR_LINE.test(line)) {
      separatorCount++;
      const text = current.join("\n").trim();
      if (text) chunks.push(text);
      current = [];
    } else {
      current.push(line);
    }
  }

  const last = current.join("\n").trim();
  if (last) chunks.push(last);

  const maxChunkLength = chunks.reduce((m, c) => Math.max(m, c.length), 0);

  return {
    poems: chunks.map((content, i) => ({
      id: crypto.randomUUID(),
      index: i + 1,
      content,
    })),
    hasSeparator: separatorCount > 0,
    maxChunkLength,
    totalLength: normalized.length,
  };
}

/* parsePoems — тонкая обёртка для обратной совместимости. */
export function parsePoems(raw: string): Poem[] {
  return parsePoemsDetailed(raw).poems;
}
