import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Group, Poem } from "../types";
import { DEFAULT_STOPWORDS } from "../lib/stopwords";
import { idbStorage } from "../lib/storage";

interface PoemsState {
  poems: Poem[];
  fileName: string | null;
  groups: Group[];
  stopwords: string[];

  setPoems: (poems: Poem[], fileName: string) => void;
  clear: () => void;

  createGroup: (name: string, poemIds?: string[]) => string;
  renameGroup: (id: string, name: string) => void;
  deleteGroup: (id: string) => void;
  addToGroup: (groupId: string, poemIds: string[]) => void;
  removeFromGroup: (groupId: string, poemIds: string[]) => void;

  addStopword: (word: string) => void;
  removeStopword: (word: string) => void;
  resetStopwords: () => void;
}

export const usePoemsStore = create<PoemsState>()(
  persist(
    (set) => ({
      poems: [],
      fileName: null,
      groups: [],
      stopwords: [...DEFAULT_STOPWORDS],

      setPoems: (poems, fileName) => set({ poems, fileName, groups: [] }),

      // Очищаем только содержимое корпуса.
      // Группы и stopwords — пользовательские настройки, они остаются.
      // (Группы уже очищаются в setPoems, потому что ссылаются на стихи.)
      clear: () => set({ poems: [], fileName: null, groups: [] }),

      createGroup: (name, poemIds = []) => {
        const id = crypto.randomUUID();
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id,
              name: name.trim() || "Без названия",
              poemIds: [...new Set(poemIds)],
            },
          ],
        }));
        return id;
      },

      renameGroup: (id, name) =>
        set((state) => ({
          groups: state.groups.map((g) => (g.id === id ? { ...g, name } : g)),
        })),

      deleteGroup: (id) =>
        set((state) => ({
          groups: state.groups.filter((g) => g.id !== id),
        })),

      addToGroup: (groupId, poemIds) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId
              ? { ...g, poemIds: [...new Set([...g.poemIds, ...poemIds])] }
              : g,
          ),
        })),

      removeFromGroup: (groupId, poemIds) =>
        set((state) => {
          const drop = new Set(poemIds);
          return {
            groups: state.groups.map((g) =>
              g.id === groupId
                ? { ...g, poemIds: g.poemIds.filter((id) => !drop.has(id)) }
                : g,
            ),
          };
        }),

      addStopword: (word) =>
        set((state) => {
          const w = word.trim().toLowerCase();
          if (!w || state.stopwords.includes(w)) return state;
          return {
            stopwords: [...state.stopwords, w].sort((a, b) =>
              a.localeCompare(b),
            ),
          };
        }),

      removeStopword: (word) =>
        set((state) => ({
          stopwords: state.stopwords.filter((w) => w !== word),
        })),

      resetStopwords: () => set({ stopwords: [...DEFAULT_STOPWORDS] }),
    }),
    {
      name: "poetry-analyzer",
      storage: createJSONStorage(() => idbStorage),
      version: 1,
      migrate: (persisted) => persisted as PoemsState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PoemsState>;
        return {
          ...current,
          ...p,
          groups: p.groups ?? [],
          stopwords: p.stopwords ?? [...DEFAULT_STOPWORDS],
        };
      },
    },
  ),
);
