export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StringStore {
  get(): string | null;
  set(value: string): void;
  clear(): void;
  /** `false` quando o armazenamento está indisponível ou bloqueado (o valor vive só em memória). */
  readonly persisted: boolean;
}

/** Acesso seguro a `window.sessionStorage`/`localStorage`: devolve `null` se não existir ou lançar. */
export function resolveStorage(name: "sessionStorage" | "localStorage"): KeyValueStorage | null {
  try {
    const storage = (globalThis as Record<string, unknown>)[name] as KeyValueStorage | undefined;
    return storage ?? null;
  } catch {
    return null;
  }
}

/** Um único valor de texto com fallback em memória; todo acesso ao armazenamento é protegido. */
export function createStringStore(storageKey: string, storage: KeyValueStorage | null): StringStore {
  let memory: string | null = null;
  let persisted = storage !== null;

  function read(): string | null {
    if (!storage) return memory;
    try {
      const value = storage.getItem(storageKey);
      return value ?? memory;
    } catch {
      persisted = false;
      return memory;
    }
  }

  return {
    get() {
      return read();
    },
    set(value) {
      memory = value;
      if (!storage) return;
      try {
        storage.setItem(storageKey, value);
      } catch {
        persisted = false;
      }
    },
    clear() {
      memory = null;
      if (!storage) return;
      try {
        storage.removeItem(storageKey);
      } catch {
        persisted = false;
      }
    },
    get persisted() {
      return persisted;
    },
  };
}
