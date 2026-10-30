import { test } from "node:test";
import assert from "node:assert/strict";
import { createPreviewQueue } from "./preview-queue.ts";
import type { MessagesResponse } from "../lib/events.ts";

const res = (text: string): MessagesResponse => ({
  conversationId: "22222222-2222-4222-8222-222222222222",
  messages: [
    { id: 1, role: "user", content: text, createdAt: "x" },
    { id: 2, role: "assistant", content: "R", createdAt: "x" },
  ],
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  return { promise, resolve, reject };
}
const tick = () => new Promise((r) => setImmediate(r));

test("concorrência nunca passa de 2, cada id é buscado uma vez", async () => {
  const pending = new Map<string, ReturnType<typeof deferred<MessagesResponse>>>();
  let inFlight = 0;
  let peak = 0;
  let updates = 0;
  const q = createPreviewQueue({
    getMessages: (id) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      const d = deferred<MessagesResponse>();
      pending.set(id, d);
      return d.promise.finally(() => inFlight--);
    },
    onUpdate: () => void updates++,
  });
  for (const id of ["a", "b", "c", "d", "a"]) q.request(id);
  assert.equal(pending.size, 2);
  pending.get("a")!.resolve(res("Pergunta A"));
  await tick();
  assert.equal(pending.size, 3);
  for (const id of ["b", "c", "d"]) {
    await tick();
    pending.get(id)?.resolve(res(`Pergunta ${id}`));
  }
  await tick();
  await tick();
  assert.equal(peak, 2);
  assert.equal(q.get("a"), "Pergunta A");
  assert.equal(q.get("d"), "Pergunta d");
  assert.equal(updates, 4);
});

test("falha vira null (silenciosa) e não trava a fila", async () => {
  const q = createPreviewQueue({
    getMessages: (id) => (id === "x" ? Promise.reject(new Error("falhou")) : Promise.resolve(res("ok"))),
    onUpdate: () => {},
  });
  q.request("x");
  q.request("y");
  await tick();
  await tick();
  assert.equal(q.get("x"), null);
  assert.equal(q.get("y"), "ok");
  assert.equal(q.get("nunca"), undefined);
});

test("conversa sem pergunta do usuário vira null; prévia é cortada em 60", async () => {
  const q = createPreviewQueue({
    getMessages: (id) =>
      Promise.resolve(id === "vazia" ? { ...res(""), messages: [] } : res("palavra ".repeat(30))),
    onUpdate: () => {},
  });
  q.request("vazia");
  q.request("longa");
  await tick();
  await tick();
  assert.equal(q.get("vazia"), null);
  assert.ok(q.get("longa")!.length <= 60);
});

test("cancelar descarta a fila e ignora resultados em voo", async () => {
  const d = deferred<MessagesResponse>();
  let updates = 0;
  const q = createPreviewQueue({ getMessages: () => d.promise, concurrency: 1, onUpdate: () => void updates++ });
  q.request("a");
  q.request("b");
  q.cancel();
  d.resolve(res("tarde"));
  await tick();
  await tick();
  assert.equal(q.get("a"), undefined);
  assert.equal(updates, 0);
});
