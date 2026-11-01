import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { corpusLabel, useCorpusFilter } from "../hooks/useCorpusFilter";
import { idbStorage } from "../lib/storage";
import type { CorpusRef, Poem } from "../types";
import { usePoemsStore } from "./poemsStore";

export function encodeCorpusRef(ref: CorpusRef): string {
  return typeof ref === "string" ? ref : ref.groupId;
}

export function decodeCorpusRef(value: string): CorpusRef {
  return value === "all" || value === "none" ? value : { groupId: value };
}

interface ComparisonState {
  slotA: CorpusRef;
  slotB: CorpusRef | null;
  setSlotA: (ref: CorpusRef) => void;
  setSlotB: (ref: CorpusRef | null) => void;
  swap: () => void;
  clearB: () => void;
}

export const useComparisonStore = create<ComparisonState>()(
  persist(
    (set) => ({
      slotA: "all",
      slotB: null,
      setSlotA: (ref) => set({ slotA: ref }),
      setSlotB: (ref) => set({ slotB: ref }),
      swap: () =>
        set((state) =>
          state.slotB ? { slotA: state.slotB, slotB: state.slotA } : state,
        ),
      clearB: () => set({ slotB: null }),
    }),
    {
      name: "poetry-analyzer-comparison",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      migrate: (persisted) => persisted as ComparisonState,
    },
  ),
);

export interface CorpusSelection {
  a: Poem[];
  b: Poem[] | null;
  refA: CorpusRef;
  refB: CorpusRef | null;
  keyA: string;
  keyB: string | null;
  labelA: string;
  labelB: string | null;
}

export function useResolvedSelection(
  refA: CorpusRef,
  refB: CorpusRef | null,
): CorpusSelection {
  const groups = usePoemsStore((s) => s.groups);
  const { poems: a, activeKey: keyA } = useCorpusFilter(encodeCorpusRef(refA));
  const { poems: poemsB, activeKey: activeKeyB } = useCorpusFilter(
    refB ? encodeCorpusRef(refB) : "all",
  );

  return useMemo(() => {
    const hasB = refB != null && activeKeyB !== keyA;
    return {
      a,
      b: hasB ? poemsB : null,
      refA,
      refB: hasB ? refB : null,
      keyA,
      keyB: hasB ? activeKeyB : null,
      labelA: corpusLabel(keyA, groups),
      labelB: hasB ? corpusLabel(activeKeyB, groups) : null,
    };
  }, [a, poemsB, refA, refB, keyA, activeKeyB, groups]);
}

export function useCorpusSelection(): CorpusSelection {
  const slotA = useComparisonStore((s) => s.slotA);
  const slotB = useComparisonStore((s) => s.slotB);
  return useResolvedSelection(slotA, slotB);
}
