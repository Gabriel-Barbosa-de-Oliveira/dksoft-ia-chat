import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCESS_KEY_STORAGE_KEY, createAccessKeyStore } from "./access-key.ts";
import type { KeyValueStorage } from "./string-store.ts";

function fakeStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: KeyValueStorage = {
  getItem() { throw new DOMException("bloqueado", "SecurityError"); },
  setItem() { throw new DOMException("bloqueado", "SecurityError"); },
  removeItem() { throw new DOMException("bloqueado", "SecurityError"); },
};

test("guarda e lê na chave dksoft.accessKey", () => {
  const storage = fakeStorage();
  const store = createAccessKeyStore(storage);
  assert.equal(store.get(), null);
  store.set("segredo-de-32-caracteres-........");
  assert.equal(storage.data.get(ACCESS_KEY_STORAGE_KEY), "segredo-de-32-caracteres-........");
  assert.equal(store.get(), "segredo-de-32-caracteres-........");
  assert.equal(store.persisted, true);
  store.clear();
  assert.equal(store.get(), null);
  assert.equal(storage.data.size, 0);
});

test("armazenamento que lança cai para memória e marca persisted=false", () => {
  const store = createAccessKeyStore(throwing);
  store.set("abc");
  assert.equal(store.get(), "abc");
  assert.equal(store.persisted, false);
  store.clear();
  assert.equal(store.get(), null);
});

test("sem armazenamento usa memória", () => {
  const store = createAccessKeyStore(null);
  assert.equal(store.persisted, false);
  store.set("abc");
  assert.equal(store.get(), "abc");
});

test("chave vazia não é guardada", () => {
  const store = createAccessKeyStore(fakeStorage());
  store.set("");
  assert.equal(store.get(), null);
});
