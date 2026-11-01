import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiErrorBodySchema, ChatMessageSchema, ConversationPageSchema, MessagesResponseSchema, parseStreamFrame } from "./events.ts";
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

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const chartSpec = {
  id: U, type: "bar", title: "Recebido", valueKind: "currency", categories: ["a"],
  series: [{ name: "s", values: [1] }], summary: "r", resultId: U, partial: false,
};

test("spec 004: result, chart e file são eventos conhecidos e validados", () => {
  const result = { resultId: U, label: "Contas", rows: 3, totalRows: 3, capped: false, expiresAt: "2026-10-31T22:00:00.000Z" };
  assert.deepEqual(parseStreamFrame(f("result", result)), { event: "result", ...result });
  assert.equal((parseStreamFrame(f("chart", { chart: chartSpec })) as { event: string }).event, "chart");
  assert.throws(() => parseStreamFrame(f("result", { ...result, rows: 0 })), UnexpectedResponseError);
  assert.throws(() => parseStreamFrame(f("chart", { chart: { ...chartSpec, type: "radar" } })), UnexpectedResponseError);
  assert.throws(() => parseStreamFrame(f("file", { file: {} })), UnexpectedResponseError);
});

test("spec 004: eventos futuros continuam ignorados (compatibilidade)", () => {
  assert.equal(parseStreamFrame(f("export_progress", { pct: 10 })), "ignored");
});

test("spec 004: mensagem aceita charts opcional", () => {
  const base = { id: 1, role: "assistant", content: "x", createdAt: "2026-10-31T00:00:00Z" };
  assert.ok(ChatMessageSchema.safeParse(base).success);
  assert.ok(ChatMessageSchema.safeParse({ ...base, charts: [chartSpec] }).success);
  assert.ok(!ChatMessageSchema.safeParse({ ...base, charts: [{ ...chartSpec, id: "x" }] }).success);
});
