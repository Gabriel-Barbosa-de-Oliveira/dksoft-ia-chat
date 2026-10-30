import { test } from "node:test";
import assert from "node:assert/strict";
import { activeTurn, chatReducer, initialView, type ChatAction, type ConversationView } from "./chat-reducer.ts";
import { toUserError } from "./errors.ts";

const run = (actions: ChatAction[], from: ConversationView = initialView) => actions.reduce(chatReducer, from);
const send: ChatAction = { type: "SEND", question: "Quais pacotes?", key: "k1" };
const meta: ChatAction = { type: "META", requestId: "r1", conversationId: "c1" };
const last = (v: ConversationView) => v.turns.at(-1)!;

test("caminho feliz: pending → working → streaming → done", () => {
  let v = run([send]);
  assert.equal(last(v).status, "pending");
  v = run([meta], v);
  assert.equal(last(v).status, "working");
  assert.equal(v.conversationId, "c1");
  v = run([{ type: "TOOL_START", name: "t", label: "Buscando…" }], v);
  assert.deepEqual(last(v).tools, [{ name: "t", label: "Buscando…", phase: "running" }]);
  v = run([{ type: "TOOL_END", name: "t", label: "Buscando…", ok: true }], v);
  assert.equal(last(v).tools[0]!.phase, "ok");
  v = run([{ type: "TOKENS", text: "O " }, { type: "TOKENS", text: "aluno" }], v);
  assert.equal(last(v).status, "streaming");
  assert.equal(last(v).text, "O aluno");
  v = run([{ type: "DONE", requestId: "r1", model: "m", partial: false }], v);
  assert.equal(last(v).status, "done");
  assert.equal(last(v).model, "m");
  assert.equal(last(v).partial, false);
  assert.equal(activeTurn(v), undefined);
});

test("done parcial marca partial", () => {
  const v = run([send, meta, { type: "DONE", requestId: "r1", model: null, partial: true }]);
  assert.equal(last(v).partial, true);
  assert.equal(last(v).status, "done");
});

test("done sem texto vai direto de working a done", () => {
  const v = run([send, meta, { type: "DONE", requestId: "r1", model: null, partial: false }]);
  assert.equal(last(v).status, "done");
  assert.equal(last(v).text, "");
});

test("erro HTTP antes do meta", () => {
  const error = toUserError({ source: "http", status: 500, body: { requestId: "rx", error: "internal_error" } });
  const v = run([send, { type: "ERROR", error }]);
  assert.equal(last(v).status, "error");
  assert.equal(last(v).requestId, "rx");
  assert.equal(v.conversationId, null);
});

test("erro no meio mantém o texto parcial e fecha consultas abertas", () => {
  const error = toUserError({ source: "stream", code: "timeout", requestId: "r1" });
  const v = run([
    send, meta,
    { type: "TOOL_START", name: "t", label: "l" },
    { type: "TOKENS", text: "parcial" },
    { type: "ERROR", error },
  ]);
  assert.equal(last(v).status, "error");
  assert.equal(last(v).text, "parcial");
  assert.equal(last(v).tools[0]!.phase, "failed");
});

test("interrupção mantém o texto", () => {
  const v = run([send, meta, { type: "TOKENS", text: "abc" }, { type: "ABORT" }]);
  assert.equal(last(v).status, "interrupted");
  assert.equal(last(v).text, "abc");
});

test("eventos depois de um estado terminal são descartados", () => {
  const done = run([send, meta, { type: "TOKENS", text: "a" }, { type: "DONE", requestId: "r1", model: null, partial: false }]);
  const after = run(
    [{ type: "TOKENS", text: "tarde" }, { type: "TOOL_START", name: "t", label: "l" }, { type: "ABORT" }, meta],
    done,
  );
  assert.equal(after, done);
});

test("duas consultas da mesma ferramenta fecham na ordem de chegada", () => {
  const v = run([
    send, meta,
    { type: "TOOL_START", name: "t", label: "primeira" },
    { type: "TOOL_START", name: "t", label: "segunda" },
    { type: "TOOL_END", name: "t", label: "primeira", ok: true },
  ]);
  assert.deepEqual(last(v).tools.map((t) => t.phase), ["ok", "running"]);
  const w = run([{ type: "TOOL_END", name: "t", label: "segunda", ok: false }], v);
  assert.deepEqual(last(w).tools.map((t) => t.phase), ["ok", "failed"]);
});

test("end sem start cria o aviso já fechado", () => {
  const v = run([send, meta, { type: "TOOL_END", name: "t", label: "l", ok: true }]);
  assert.deepEqual(last(v).tools, [{ name: "t", label: "l", phase: "ok" }]);
});

test("SEND durante turno ativo é ignorado", () => {
  const v = run([send, meta]);
  assert.equal(run([{ type: "SEND", question: "outra", key: "k2" }], v), v);
});

test("novo SEND depois de terminal cria outro turno; RESET limpa", () => {
  let v = run([send, meta, { type: "DONE", requestId: "r1", model: null, partial: false }]);
  v = run([{ type: "SEND", question: "e a mais antiga?", key: "k2" }], v);
  assert.equal(v.turns.length, 2);
  assert.equal(v.conversationId, "c1");
  assert.equal(run([{ type: "RESET" }], v), initialView);
});

test("tokens vazios são ignorados", () => {
  const v = run([send, meta]);
  assert.equal(run([{ type: "TOKENS", text: "" }], v), v);
});

// ---------- histórico (US2) ----------
import { messagesToTurns } from "./chat-reducer.ts";
import type { ChatMessage } from "./events.ts";

const msg = (id: number, role: "user" | "assistant", content: string): ChatMessage => ({ id, role, content, createdAt: "2026-10-30T12:00:00.000Z" });

test("messagesToTurns: pares em ordem", () => {
  const turns = messagesToTurns([msg(1, "user", "a"), msg(2, "assistant", "A"), msg(3, "user", "b"), msg(4, "assistant", "B")]);
  assert.deepEqual(turns.map((t) => [t.question, t.text, t.status, t.partial]), [["a", "A", "done", false], ["b", "B", "done", false]]);
  assert.deepEqual(turns.map((t) => t.key), ["h-1", "h-3"]);
  assert.deepEqual(turns[0]!.tools, []);
});

test("messagesToTurns: mensagem user solta vira turno de texto vazio e não quebra", () => {
  const turns = messagesToTurns([msg(1, "user", "a"), msg(2, "user", "b"), msg(3, "assistant", "B")]);
  assert.deepEqual(turns.map((t) => [t.question, t.text]), [["a", ""], ["b", "B"]]);
  assert.deepEqual(messagesToTurns([msg(1, "user", "a")]).map((t) => t.text), [""]);
  assert.deepEqual(messagesToTurns([]), []);
});

test("carga: loading → ready", () => {
  let v = run([{ type: "LOAD_START", conversationId: "c1" }]);
  assert.equal(v.phase, "loading");
  assert.equal(v.conversationId, "c1");
  v = run([{ type: "LOAD_OK", conversationId: "c1", messages: [msg(1, "user", "a"), msg(2, "assistant", "A")] }], v);
  assert.equal(v.phase, "ready");
  assert.equal(v.turns.length, 1);
});

test("carga sem mensagens vira empty", () => {
  const v = run([{ type: "LOAD_START", conversationId: "c1" }, { type: "LOAD_OK", conversationId: "c1", messages: [] }]);
  assert.equal(v.phase, "empty");
});

test("carga de outra conversa, atrasada, é descartada", () => {
  const v = run([{ type: "LOAD_START", conversationId: "b" }]);
  assert.equal(run([{ type: "LOAD_OK", conversationId: "a", messages: [msg(1, "user", "x")] }], v), v);
  assert.equal(run([{ type: "LOAD_ERROR", conversationId: "a", error: toUserError({ source: "network" }) }], v), v);
});

test("erro de carga fica isolado e mantém o id", () => {
  const error = toUserError({ source: "network" });
  const v = run([{ type: "LOAD_START", conversationId: "c1" }, { type: "LOAD_ERROR", conversationId: "c1", error }]);
  assert.equal(v.phase, "error");
  assert.equal(v.loadError, error);
  assert.equal(v.conversationId, "c1");
});

test("conversa não encontrada bloqueia o envio", () => {
  const v = run([{ type: "LOAD_NOT_FOUND", conversationId: "x" }]);
  assert.equal(v.phase, "not-found");
  assert.equal(run([send], v), v);
});

test("SEND durante a carga é ignorado; RESET volta ao vazio", () => {
  const loading = run([{ type: "LOAD_START", conversationId: "c1" }]);
  assert.equal(run([send], loading), loading);
  assert.equal(run([{ type: "RESET" }], loading), initialView);
});

// ---------- nova tentativa (US3) ----------
test("DISCARD_ERROR_TURN remove só o último turno em erro e permite reenviar a mesma pergunta", () => {
  const error = toUserError({ source: "network" });
  let v = run([send, { type: "ERROR", error }]);
  assert.equal(run([{ type: "DISCARD_ERROR_TURN", key: "outra" }], v), v, "chave diferente: nada muda");
  v = run([{ type: "DISCARD_ERROR_TURN", key: "k1" }], v);
  assert.equal(v.turns.length, 0);
  v = run([{ type: "SEND", question: "Quais pacotes?", key: "k2" }], v);
  assert.equal(last(v).question, "Quais pacotes?");
  assert.equal(last(v).status, "pending");
});

test("DISCARD_ERROR_TURN não toca em turno concluído ou ativo", () => {
  const active = run([send, meta]);
  assert.equal(run([{ type: "DISCARD_ERROR_TURN", key: "k1" }], active), active);
  const done = run([{ type: "DONE", requestId: "r1", model: null, partial: false }], active);
  assert.equal(run([{ type: "DISCARD_ERROR_TURN", key: "k1" }], done), done);
});

test("a conversa existente continua a mesma depois de descartar o erro", () => {
  const error = toUserError({ source: "stream", code: "timeout", requestId: "r1" });
  const v = run([send, meta, { type: "ERROR", error }, { type: "DISCARD_ERROR_TURN", key: "k1" }]);
  assert.equal(v.conversationId, "c1");
});
