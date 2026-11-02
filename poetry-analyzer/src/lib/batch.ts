import type { Poem } from "../types";
import type { AnalysisMode, PoemAnalysis } from "./api";
import { analyzeBatchApi, isFullAnalysis } from "./api";
import { useAnalysisStore } from "../store/analysisStore";

export interface BatchFailure {
  poemId: string;
  index: number;
  error: string;
}

export interface BatchProgress {
  done: number;
  total: number;
  cancelled: boolean;
  failed: BatchFailure[];
}

const CHUNK_SIZE = 10;

function satisfiesRequest(
  cached: PoemAnalysis | undefined,
  mode: AnalysisMode,
) {
  if (!cached) return false;
  if (mode === "lemmas") return true;
  return isFullAnalysis(cached);
}

/**
 * Анализирует стихи, которых ещё нет в кэше (с учётом режима), чанками по 10.
 * Результаты пишутся в analysisStore после каждого чанка.
 * Прерывается через AbortSignal. Ошибки по отдельным стихам — в progress.failed.
 *
 * Примечание: пока RPST отключён на бэкенде (деплой на Vercel), вызовы
 * должны идти с mode="lemmas". Параметр mode оставлен обязательным для
 * совместимости — если однажды RPST вернётся, вызовы с mode="full" снова
 * заработают без правок в этом файле.
 */
export async function analyzeBatch(
  poems: Poem[],
  mode: AnalysisMode,
  onProgress: (p: BatchProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { analyses, setManyAnalyses } = useAnalysisStore.getState();

  const pending = poems.filter((p) => !satisfiesRequest(analyses[p.id], mode));
  const total = poems.length;
  let done = total - pending.length;
  const failed: BatchFailure[] = [];

  onProgress({ done, total, cancelled: false, failed });

  for (let start = 0; start < pending.length; start += CHUNK_SIZE) {
    if (signal?.aborted) {
      onProgress({ done, total, cancelled: true, failed });
      return;
    }

    const chunk = pending.slice(start, start + CHUNK_SIZE);
    try {
      const results = await analyzeBatchApi(
        chunk.map((p) => ({ id: p.id, text: p.content })),
        mode,
      );

      const buffer: Record<string, PoemAnalysis> = {};
      for (const r of results) {
        if (r.analysis) {
          buffer[r.id] = r.analysis;
        } else {
          const poem = chunk.find((p) => p.id === r.id);
          failed.push({
            poemId: r.id,
            index: poem?.index ?? -1,
            error: r.error ?? "unknown error",
          });
        }
      }
      setManyAnalyses(buffer);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      for (const poem of chunk) {
        failed.push({ poemId: poem.id, index: poem.index, error: message });
      }
    }

    done += chunk.length;
    onProgress({ done, total, cancelled: false, failed });
  }
}
