import { parseThemePreference, type ThemePreference } from "../lib/theme.ts";
import { createStringStore, resolveStorage, type KeyValueStorage } from "./string-store.ts";

export const THEME_STORAGE_KEY = "dksoft.theme";

export interface ThemePreferenceStore {
  get(): ThemePreference;
  set(pref: ThemePreference): void;
  readonly persisted: boolean;
}

/** Preferência de tema: `localStorage` (entre visitas) com fallback em memória. */
export function createThemePreferenceStore(storage: KeyValueStorage | null = resolveStorage("localStorage")): ThemePreferenceStore {
  const store = createStringStore(THEME_STORAGE_KEY, storage);
  return {
    get: () => parseThemePreference(store.get()),
    set: (pref) => store.set(pref),
    get persisted() {
      return store.persisted;
    },
  };
}
