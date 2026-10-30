import { test } from "node:test";
import assert from "node:assert/strict";
import { THEME_STORAGE_KEY, createThemePreferenceStore } from "./theme-preference.ts";
import type { KeyValueStorage } from "./string-store.ts";

function fakeStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

test("padrão é system e persiste a escolha", () => {
  const storage = fakeStorage();
  const store = createThemePreferenceStore(storage);
  assert.equal(store.get(), "system");
  store.set("dark");
  assert.equal(storage.data.get(THEME_STORAGE_KEY), "dark");
  assert.equal(createThemePreferenceStore(storage).get(), "dark");
});

test("valor corrompido vira system", () => {
  assert.equal(createThemePreferenceStore(fakeStorage({ [THEME_STORAGE_KEY]: "roxo" })).get(), "system");
});

test("armazenamento bloqueado mantém a escolha em memória", () => {
  const blocked: KeyValueStorage = {
    getItem() { throw new Error("x"); },
    setItem() { throw new Error("x"); },
    removeItem() { throw new Error("x"); },
  };
  const store = createThemePreferenceStore(blocked);
  store.set("light");
  assert.equal(store.get(), "light");
  assert.equal(store.persisted, false);
});
