// src/store/analysisProgressStore.ts
import { create } from "zustand";
import type { Poem } from "../types";
import {
  analyzeBatch,
  type BatchFailure,
  type BatchProgress,
} from "../lib/batch";
import type { AnalysisMode } from "../lib/api";

interface AnalysisProgressState {
  /** Какой режим сейчас идёт (null — ничего не запущено). */
  runningMode: AnalysisMode | null;
  /** Текущий прогресс (null — не запущено). */
  progress: BatchProgress | null;
  /** Ошибки последнего запуска (по отдельным стихам или по чанкам). */
  lastFailed: BatchFailure[];
  /** Последний запуск был отменён пользователем. */
  lastCancelled: boolean;
  /** Непредвиденная ошибка запуска (не per-poem, а «батч не стартовал»). */
  lastError: string | null;

  start: (poems: Poem[], mode: AnalysisMode) => Promise<void>;
  cancel: () => void;
  clearFailed: () => void;
  clearLastError: () => void;
}

// Контроллер отмены — обычная переменная модуля (не React ref),
// потому что живёт вне рендер-цикла.
let abortController: AbortController | null = null;

export const useAnalysisProgressStore = create<AnalysisProgressState>(
  (set, get) => ({
    runningMode: null,
    progress: null,
    lastFailed: [],
    lastCancelled: false,
    lastError: null,

    start: async (poems, mode) => {
      if (get().runningMode !== null) return;
      if (poems.length === 0) return;

      set({
        runningMode: mode,
        progress: {
          done: 0,
          total: poems.length,
          failed: [],
          cancelled: false,
        },
        lastFailed: [],
        lastCancelled: false,
        lastError: null,
      });

      const controller = new AbortController();
      abortController = controller;

      try {
        await analyzeBatch(
          poems,
          mode,
          (p) => set({ progress: p }),
          controller.signal,
        );
      } catch (e) {
        // Сюда мы попадаем, только если analyzeBatch сам выбросил
        // синхронно — до или вне try/catch по чанкам. Per-chunk ошибки
        // уже в progress.failed. Это «батч не смог стартовать».
        set({
          lastError: e instanceof Error ? e.message : String(e),
        });
      } finally {
        const p = get().progress;
        set({
          runningMode: null,
          progress: null,
          lastFailed: p?.failed ?? [],
          lastCancelled: p?.cancelled ?? false,
        });
        abortController = null;
      }
    },

    cancel: () => {
      abortController?.abort();
    },

    clearFailed: () => set({ lastFailed: [], lastCancelled: false }),
    clearLastError: () => set({ lastError: null }),
  }),
);
