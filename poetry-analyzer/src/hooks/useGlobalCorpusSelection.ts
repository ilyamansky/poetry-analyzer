// src/hooks/useGlobalCorpusSelection.ts
import { useEffect, useMemo } from "react";
import {
  decodeCorpusRef,
  encodeCorpusRef,
  useComparisonStore,
  useResolvedSelection,
  type CorpusSelection,
} from "../store/comparisonStore";
import type { CorpusRef, Poem } from "../types";
import { useQueryParams } from "./useQueryParams";

export interface GlobalCorpusSelection extends CorpusSelection {
  setA: (ref: CorpusRef) => void;
  setB: (ref: CorpusRef | null) => void;
  swap: () => void;
  clearB: () => void;

  /** A без стихов, входящих в B. */
  aExclB: Poem[];
  /** B без стихов, входящих в A. */
  bExclA: Poem[] | null;
  /** Сколько стихов в A ∩ B. */
  overlapCount: number;
  /** true, если A ⊂ B или B ⊂ A. */
  isSubset: boolean;
  /** true, если A и B совпадают по составу. */
  identical: boolean;

  /** Флаг «не исключать пересечение» (из URL: ?overlap=1). */
  includeOverlap: boolean;
  setIncludeOverlap: (v: boolean) => void;

  /** Наборы для сравнения — с учётом includeOverlap и вложенности. */
  aForCompare: Poem[];
  bForCompare: Poem[] | null;
}

export function useGlobalCorpusSelection(): GlobalCorpusSelection {
  const { params, setParams } = useQueryParams();
  const slotA = useComparisonStore((s) => s.slotA);
  const slotB = useComparisonStore((s) => s.slotB);
  const setSlotA = useComparisonStore((s) => s.setSlotA);
  const setSlotB = useComparisonStore((s) => s.setSlotB);

  const aParam = params.get("a");
  const bParam = params.get("b");
  const groupParam = params.get("group");

  const refA: CorpusRef = aParam
    ? decodeCorpusRef(aParam)
    : groupParam
      ? decodeCorpusRef(groupParam)
      : slotA;
  const refB: CorpusRef | null = bParam ? decodeCorpusRef(bParam) : slotB;

  const encA = encodeCorpusRef(refA);
  const encB = refB ? encodeCorpusRef(refB) : null;

  useEffect(() => {
    const state = useComparisonStore.getState();
    if (encodeCorpusRef(state.slotA) !== encA)
      state.setSlotA(decodeCorpusRef(encA));
    const storeB = state.slotB ? encodeCorpusRef(state.slotB) : null;
    if (storeB !== encB) state.setSlotB(encB ? decodeCorpusRef(encB) : null);
  }, [encA, encB]);

  const includeOverlap = params.get("overlap") === "1";

  const setIncludeOverlap = (v: boolean) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v) next.set("overlap", "1");
        else next.delete("overlap");
        return next;
      },
      { replace: true },
    );
  };

  const writeParams = (a: string, b: string | null) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (a === "all") next.delete("a");
        else next.set("a", a);
        if (b) next.set("b", b);
        else next.delete("b");
        next.delete("group");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  const setA = (ref: CorpusRef) => {
    setSlotA(ref);
    writeParams(encodeCorpusRef(ref), encB);
  };

  const setB = (ref: CorpusRef | null) => {
    setSlotB(ref);
    writeParams(encA, ref ? encodeCorpusRef(ref) : null);
  };

  const swap = () => {
    if (!refB || encB === null) return;
    setSlotA(refB);
    setSlotB(refA);
    writeParams(encB, encA);
  };

  const clearB = () => setB(null);

  const selection = useResolvedSelection(refA, refB);

  const comparison = useMemo(() => {
    const a = selection.a ?? [];
    const b = selection.b;

    if (!b || b.length === 0) {
      return {
        aExclB: a,
        bExclA: null as Poem[] | null,
        overlapCount: 0,
        isSubset: false,
        identical: false,
        aForCompare: a,
        bForCompare: null as Poem[] | null,
      };
    }

    const aIds = new Set(a.map((p) => p.id));
    const bIds = new Set(b.map((p) => p.id));

    let overlapCount = 0;
    for (const p of a) if (bIds.has(p.id)) overlapCount++;

    const aExclB = a.filter((p) => !bIds.has(p.id));
    const bExclA = b.filter((p) => !aIds.has(p.id));

    const identical = overlapCount === a.length && overlapCount === b.length;
    const isSubset =
      !identical && (overlapCount === a.length || overlapCount === b.length);

    let aForCompare: Poem[];
    let bForCompare: Poem[];

    if (includeOverlap) {
      aForCompare = a;
      bForCompare = b;
    } else if (identical) {
      aForCompare = [];
      bForCompare = [];
    } else if (bExclA.length === 0 && aExclB.length > 0) {
      // B ⊂ A: сравниваем «A без B» vs «B целиком»
      aForCompare = aExclB;
      bForCompare = b;
    } else if (aExclB.length === 0 && bExclA.length > 0) {
      // A ⊂ B: сравниваем «A целиком» vs «B без A»
      aForCompare = a;
      bForCompare = bExclA;
    } else {
      // Частичное пересечение или нет пересечения
      aForCompare = aExclB;
      bForCompare = bExclA;
    }

    return {
      aExclB,
      bExclA,
      overlapCount,
      isSubset,
      identical,
      aForCompare,
      bForCompare,
    };
  }, [selection.a, selection.b, includeOverlap]);

  return {
    ...selection,
    ...comparison,
    setA,
    setB,
    swap,
    clearB,
    includeOverlap,
    setIncludeOverlap,
  };
}
