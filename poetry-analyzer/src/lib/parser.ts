import type { Poem } from "../types";

/* Строка, состоящая только из 3+ звёздочек (возможно, с пробелами). */
const STAR_LINE = /^\s*\*{3,}\s*$/;

export function parsePoems(raw: string): Poem[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (STAR_LINE.test(line)) {
      const text = current.join("\n").trim();
      if (text) chunks.push(text);
      current = [];
    } else {
      current.push(line);
    }
  }

  const last = current.join("\n").trim();
  if (last) chunks.push(last);

  return chunks.map((content, i) => ({
    id: crypto.randomUUID(),
    index: i + 1,
    content,
  }));
}
