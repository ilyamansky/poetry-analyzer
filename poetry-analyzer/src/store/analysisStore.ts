import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { PoemAnalysis } from "../lib/api";
import { idbStorage } from "../lib/storage";

interface AnalysisStore {
  analyses: Record<string, PoemAnalysis>;
  setAnalysis: (poemId: string, analysis: PoemAnalysis) => void;
  setManyAnalyses: (entries: Record<string, PoemAnalysis>) => void;
  removeAnalysis: (poemId: string) => void;
  clearAll: () => void;
}

export const useAnalysisStore = create<AnalysisStore>()(
  persist(
    (set) => ({
      analyses: {},
      setAnalysis: (poemId, analysis) =>
        set((state) => ({
          analyses: { ...state.analyses, [poemId]: analysis },
        })),
      setManyAnalyses: (entries) =>
        set((state) => ({
          analyses: { ...state.analyses, ...entries },
        })),
      removeAnalysis: (poemId) =>
        set((state) => {
          const next = { ...state.analyses };
          delete next[poemId];
          return { analyses: next };
        }),
      clearAll: () => set({ analyses: {} }),
    }),
    {
      name: "poetry-analyzer-analysis",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      migrate: (persisted) => persisted as AnalysisStore,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AnalysisStore>;
        return { ...current, ...p, analyses: p.analyses ?? {} };
      },
    },
  ),
);
