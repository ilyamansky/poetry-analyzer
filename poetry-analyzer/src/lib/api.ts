// src/lib/api.ts

// Базовый URL бэкенда.
// - В dev: пустая строка → относительные пути `/api/*` идут через
//   Vite proxy (см. vite.config.ts → server.proxy), который
//   перенаправляет их на http://localhost:8000.
// - В prod (Vercel): VITE_API_BASE_URL задаётся в настройках проекта
//   и указывает на задеплоенный бэкенд (например,
//   https://poetry-analyzer-blond.vercel.app).
// - Если переменная не задана вообще, остаётся пустая строка —
//   запросы идут на тот же origin, что и фронт.
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export interface TokenAnalysis {
  original: string;
  lemma: string;
  pos: string;
  score: number;
}

export type AnalysisMode = "full" | "lemmas";

export interface PoemAnalysis {
  lemmas: string[];
  tokens: TokenAnalysis[];
  meter: string | null;
  rhymeScheme: string | null;
  scansionScore: number | null;
  stressedLines: string[] | null;
  mode: AnalysisMode;
}

export function isFullAnalysis(a: PoemAnalysis): boolean {
  return a.mode === "full";
}

interface ServerResponse {
  lemmas: string[];
  tokens: TokenAnalysis[];
  meter: string | null;
  rhyme_scheme: string | null;
  scansion_score: number | null;
  stressed_lines: string[] | null;
}

function mapResponse(data: ServerResponse, mode: AnalysisMode): PoemAnalysis {
  return {
    lemmas: data.lemmas,
    tokens: data.tokens,
    meter: data.meter,
    rhymeScheme: data.rhyme_scheme,
    scansionScore: data.scansion_score,
    stressedLines: data.stressed_lines ?? null,
    mode,
  };
}

export async function analyzePoem(
  text: string,
  mode: AnalysisMode = "full",
): Promise<PoemAnalysis> {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text, mode }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error (${response.status}): ${errorBody}`);
  }

  const data: ServerResponse = await response.json();
  return mapResponse(data, mode);
}

interface BatchServerResult extends ServerResponse {
  id: string;
  error: string | null;
}

export interface BatchResult {
  id: string;
  analysis: PoemAnalysis | null;
  error: string | null;
}

export async function analyzeBatchApi(
  items: { id: string; text: string }[],
  mode: AnalysisMode,
): Promise<BatchResult[]> {
  const response = await fetch(`${API_BASE}/api/analyze-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      items: items.map((item) => ({ ...item, mode })),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error (${response.status}): ${errorBody}`);
  }

  const data: { results: BatchServerResult[] } = await response.json();

  return data.results.map((r) => ({
    id: r.id,
    analysis: r.error ? null : mapResponse(r, mode),
    error: r.error,
  }));
}

// --- Обработка результатов ---

const METER_NAMES: Record<string, string> = {
  yamb: "ямб",
  iamb: "ямб",
  horey: "хорей",
  trochee: "хорей",
  dactyl: "дактиль",
  amphibrach: "амфибрахий",
  anapest: "анапест",
  dolnik: "дольник",
  taktovik: "тактовик",
  accentual: "акцентный стих",
  freeverse: "верлибр",
  free_verse: "верлибр",
  vers_loose: "верлибр",
  hexameter: "гекзаметр",
  alexandrine: "александрийский стих",
  unknown: "не определён",
};

export function translateMeter(meter: string | null): string | null {
  if (!meter) return null;
  const key = meter.toLowerCase().trim();
  return METER_NAMES[key] ?? meter;
}
