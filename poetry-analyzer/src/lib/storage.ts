import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

/**
 * Хранилище zustand persist поверх IndexedDB.
 * При первом чтении забирает значение из localStorage (старое хранилище),
 * сразу переносит его в IndexedDB и удаляет оттуда — дальше работает
 * только IndexedDB.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    const value = await get<string>(name);
    if (value != null) return value;
    const legacy = localStorage.getItem(name);
    if (legacy != null) {
      localStorage.removeItem(name);
      await set(name, legacy);
      return legacy;
    }
    return null;
  },
  setItem: async (name, value) => {
    await set(name, value);
  },
  removeItem: async (name) => {
    await del(name);
  },
};
