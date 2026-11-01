import { useMemo } from "react";
import { usePoemsStore } from "../store/poemsStore";
import type { Group, Poem } from "../types";

export interface CorpusFilter {
  poems: Poem[];
  /** Нормализованный ключ: неизвестная или удалённая группа → "all". */
  activeKey: string;
}

export function useCorpusFilter(groupKey: string): CorpusFilter {
  const poems = usePoemsStore((s) => s.poems);
  const groups = usePoemsStore((s) => s.groups);

  return useMemo(() => {
    if (groupKey === "none") {
      const inAny = new Set(groups.flatMap((g) => g.poemIds));
      return {
        poems: poems.filter((p) => !inAny.has(p.id)),
        activeKey: "none",
      };
    }
    if (groupKey !== "all") {
      const g = groups.find((x) => x.id === groupKey);
      if (g) {
        const ids = new Set(g.poemIds);
        return { poems: poems.filter((p) => ids.has(p.id)), activeKey: g.id };
      }
    }
    return { poems, activeKey: "all" };
  }, [poems, groups, groupKey]);
}

export function corpusLabel(key: string, groups: Group[]): string {
  if (key === "all") return "Весь корпус";
  if (key === "none") return "Без группы";
  return groups.find((g) => g.id === key)?.name ?? "Весь корпус";
}
