import { test } from "node:test";
import assert from "node:assert/strict";
import { runTurn } from "./run-turn.ts";
import type { ChatAction } from "../lib/chat-reducer.ts";
import type { StreamEvent } from "../lib/events.ts";
import { ApiFailure } from "../lib/failures.ts";

const meta: StreamEvent = { event: "meta", requestId: "r1", conversationId: "c1" };
const token = (text: string): StreamEvent => ({ event: "token", text });
const done = (partial = false): StreamEvent => ({ event: "done", requestId: "r1", conversationId: "c1", model: "m", durationMs: 1, partial });

async function* from(events: StreamEvent[], then?: () => never): AsyncGenerator<StreamEvent> {
  for (const e of events) yield e;
  then?.();
}

function setup(signal?: AbortSignal) {
  const actions: ChatAction[] = [];
  const said: Array<["announce" | "alert", string]> = [];
  const scheduled: Array<() => void> = [];
  const cancelled: unknown[] = [];
  const deps = {
    dispatch: (a: ChatAction) => void actions.push(a),
    schedule: (fn: () => void) => (scheduled.push(fn), scheduled.length),
    cancelSchedule: (h: unknown) => void cancelled.push(h),
    announcer: { announce: (t: string) => void said.push(["announce", t]), alert: (t: string) => void said.push(["alert", t]) },
    signal,
  };
  return { actions, said, scheduled, deps };
}

test("tokens saem em lote por quadro de animação", async () => {
  const s = setup();
  const result = await runTurn({ ...s.deps, stream: from([meta, token("a"), token("b"), token("c"), done()]) });
  assert.equal(result.conversationId, "c1");
  assert.equal(s.scheduled.length, 1, "um agendamento para os três tokens");
  assert.deepEqual(s.actions.map((a) => a.type), ["META", "TOKENS", "DONE"]);
  assert.deepEqual(s.actions[1], { type: "TOKENS", text: "abc" }, "descarregado antes do done");
  assert.deepEqual(s.said, [["announce", "Resposta concluída."]]);
});

test("a descarga agendada, quando roda, envia o lote e libera novo agendamento", async () => {
  const s = setup();
  async function* gen(): AsyncGenerator<StreamEvent> {
    yield meta;
    yield token("a");
    s.scheduled[0]!();
    yield token("b");
    yield done();
  }
  await runTurn({ ...s.deps, stream: gen() });
  assert.deepEqual(s.actions.filter((a) => a.type === "TOKENS"), [
    { type: "TOKENS", text: "a" },
    { type: "TOKENS", text: "b" },
  ]);
  assert.equal(s.scheduled.length, 2);
});

test("consultas: dispara a ação e anuncia o rótulo na entrada", async () => {
  const s = setup();
  await runTurn({
    ...s.deps,
    stream: from([
      meta,
      { event: "tool", phase: "start", name: "t", label: "Buscando o aluno…" },
      { event: "tool", phase: "end", name: "t", label: "Buscando o aluno…", ok: false },
      done(true),
    ]),
  });
  assert.deepEqual(s.actions[1], { type: "TOOL_START", name: "t", label: "Buscando o aluno…" });
  assert.deepEqual(s.actions[2], { type: "TOOL_END", name: "t", label: "Buscando o aluno…", ok: false });
  assert.deepEqual(s.said, [
    ["announce", "Buscando o aluno…"],
    ["announce", "Resposta concluída. Resultado parcial."],
  ]);
});

test("evento de erro do servidor vira UserError em pt-BR e alerta", async () => {
  const s = setup();
  await runTurn({
    ...s.deps,
    stream: from([meta, token("parc"), { event: "error", requestId: "r1", code: "timeout", message: "texto cru" }]),
  });
  const error = s.actions.find((a) => a.type === "ERROR");
  assert.ok(error && error.type === "ERROR");
  assert.equal(error.error.kind, "timeout");
  assert.deepEqual(s.actions.map((a) => a.type), ["META", "TOKENS", "ERROR"], "texto parcial é descarregado antes do erro");
  assert.equal(s.said[0]![0], "alert");
  assert.doesNotMatch(s.said[0]![1], /texto cru/);
});

test("exceção da API (rede) vira ERROR", async () => {
  const s = setup();
  await runTurn({ ...s.deps, stream: from([], () => { throw new ApiFailure({ source: "network" }); }) });
  assert.deepEqual(s.actions.map((a) => a.type), ["ERROR"]);
  assert.equal((s.actions[0] as { error: { kind: string } }).error.kind, "network");
});

test("exceção no meio mantém o texto já recebido", async () => {
  const s = setup();
  await runTurn({
    ...s.deps,
    stream: from([meta, token("abc")], () => { throw new ApiFailure({ source: "client", kind: "connection_lost" }); }),
  });
  assert.deepEqual(s.actions.map((a) => a.type), ["META", "TOKENS", "ERROR"]);
});

test("Parar: fluxo termina em silêncio e vira ABORT + anúncio", async () => {
  const controller = new AbortController();
  const s = setup(controller.signal);
  async function* gen(): AsyncGenerator<StreamEvent> {
    yield meta;
    yield token("meio");
    controller.abort();
  }
  await runTurn({ ...s.deps, stream: gen() });
  assert.deepEqual(s.actions.map((a) => a.type), ["META", "TOKENS", "ABORT"]);
  assert.deepEqual(s.said, [["announce", "Resposta interrompida."]]);
});

test("Parar com exceção de aborto também vira ABORT", async () => {
  const controller = new AbortController();
  const s = setup(controller.signal);
  controller.abort();
  await runTurn({ ...s.deps, stream: from([], () => { throw new DOMException("x", "AbortError"); }) });
  assert.deepEqual(s.actions.map((a) => a.type), ["ABORT"]);
});

test("fluxo que acaba sem terminal e sem abort vira connection_lost", async () => {
  const s = setup();
  await runTurn({ ...s.deps, stream: from([meta]) });
  const error = s.actions.at(-1);
  assert.ok(error && error.type === "ERROR" && error.error.kind === "connection_lost");
});

test("onMeta é chamado com o id da conversa assim que o meta chega", async () => {
  const s = setup();
  const seen: string[] = [];
  const order: string[] = [];
  await runTurn({
    ...s.deps,
    dispatch: (a) => void order.push(a.type),
    onMeta: (id) => void (seen.push(id), order.push("onMeta")),
    stream: from([meta, token("a"), done()]),
  });
  assert.deepEqual(seen, ["c1"]);
  assert.deepEqual(order.slice(0, 2), ["META", "onMeta"]);
});
