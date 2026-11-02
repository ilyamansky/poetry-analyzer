// src/lib/regex.ts

/** Экранирует спецсимволы регулярного выражения. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
