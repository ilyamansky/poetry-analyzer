// src/lib/format.ts

export function fmt(n: number): string {
  return n.toLocaleString("ru-RU");
}

export function fmt1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}
