import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiErrorBodySchema, ConversationPageSchema, MessagesResponseSchema, parseStreamFrame } from "./events.ts";
import { UnexpectedResponseError } from "./failures.ts";
import { conversationsFull, conversationsShort, httpErrors, messages } from "./__fixtures__/http.ts";
import { REQUEST_ID, doneData } from "./__fixtures__/stream.ts";

const f = (event: string, data: unknown) => ({ event, data: JSON.stringify(data) });

test("meta, tool, token e done", () => {
  assert.deepEqual(parseStreamFrame(f("meta", { requestId: REQUEST_ID, conversationId: "c" })), {
    event: "meta",
    requestId: REQUEST_ID,
    conversationId: "c",
  });
  const tool = parseStreamFrame(f("tool", { phase: "end", name: "n", label: "l", ok: false }));
  assert.deepEqual(tool, { event: "tool", phase: "end", name: "n", label: "l", ok: false });
  assert.deepEqual(parseStreamFrame(f("token", { text: "oi" })), { event: "token", text: "oi" });
  assert.equal((parseStreamFrame(f("done", doneData)) as { partial: boolean }).partial, false);
});

test("done aceita partial e model nulo", () => {
  const ev = parseStreamFrame(f("done", { ...doneData, partial: true, model: null })) as { partial: boolean; model: null };
  assert.equal(ev.partial, true);
  assert.equal(ev.model, null);
});

test("campos extras são ignorados", () => {
  const ev = parseStreamFrame(f("token", { text: "a", extra: 1 }));
  assert.deepEqual(ev, { event: "token", text: "a" });
});

test("error aceita cada code conhecido e rejeita desconhecido", () => {
  for (const code of ["timeout", "model_unavailable", "tools_unavailable", "internal_error"]) {
    const ev = parseStreamFrame(f("error", { requestId: REQUEST_ID, code, message: "x" }));
    assert.equal((ev as { code: string }).code, code);
  }
  assert.throws(() => parseStreamFrame(f("error", { requestId: REQUEST_ID, code: "outro" })), UnexpectedResponseError);
});

test("evento desconhecido é ignorado; conhecido inválido lança", () => {
  assert.equal(parseStreamFrame(f("novidade", {})), "ignored");
  assert.throws(() => parseStreamFrame(f("token", { texto: 1 })), UnexpectedResponseError);
  assert.throws(() => parseStreamFrame({ event: "token", data: "{nao-json" }), UnexpectedResponseError);
});

test("corpos de erro HTTP, listas e mensagens", () => {
  for (const body of Object.values(httpErrors)) assert.ok(ApiErrorBodySchema.safeParse(body).success);
  assert.equal(ApiErrorBodySchema.safeParse({ error: "unauthorized" }).success, false);
  assert.ok(ConversationPageSchema.safeParse(conversationsFull).success);
  assert.ok(ConversationPageSchema.safeParse(conversationsShort).success);
  assert.ok(MessagesResponseSchema.safeParse(messages).success);
  assert.equal(ConversationPageSchema.safeParse({ conversations: [{ id: "x" }], limit: 1, offset: 0 }).success, false);
});
