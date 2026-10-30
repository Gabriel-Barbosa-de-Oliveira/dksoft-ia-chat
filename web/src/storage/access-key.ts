import { createStringStore, resolveStorage, type KeyValueStorage, type StringStore } from "./string-store.ts";

export const ACCESS_KEY_STORAGE_KEY = "dksoft.accessKey";

export interface AccessKeyStore extends Omit<StringStore, "get" | "set"> {
  get(): string | null;
  set(key: string): void;
}

/** Chave de acesso: `sessionStorage` (some ao fechar a aba) com fallback em memória. */
export function createAccessKeyStore(storage: KeyValueStorage | null = resolveStorage("sessionStorage")): AccessKeyStore {
  const store = createStringStore(ACCESS_KEY_STORAGE_KEY, storage);
  return {
    get() {
      const value = store.get();
      return value && value.length > 0 ? value : null;
    },
    set(key) {
      if (key.length > 0) store.set(key);
    },
    clear: store.clear,
    get persisted() {
      return store.persisted;
    },
  };
}
