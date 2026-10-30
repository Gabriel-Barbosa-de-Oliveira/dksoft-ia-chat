import { test } from "node:test";
import assert from "node:assert/strict";
import { CLIENT_DEADLINE_MS, streamChat } from "./chat-stream.ts";
import { createApiClient } from "./client.ts";
import { ApiFailure } from "../lib/failures.ts";
import type { StreamEvent } from "../lib/events.ts";
import { httpErrors } from "../lib/__fixtures__/http.ts";
import {
  CONVERSATION_ID, chunk, errorCodes, streamBadData, streamError, streamNoTerminal, streamOk, streamOkCrlf, streamUnknownEvent,
} from "../lib/__fixtures__/stream.ts";

const enc = new TextEncoder();

function sseResponse(parts: string[], { keepOpen = false } = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const p of parts) controller.enqueue(enc.encode(p));
      if (!keepOpen) controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function setup(respond: (init: RequestInit) => Response | Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = createApiClient({
    baseUrl: "http://api.test",
    getKey: () => "k".repeat(32),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return respond(init);
    }) as typeof fetch,
  });
  return { client, calls };
}

async function collect(gen: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

const run = (client: ReturnType<typeof setup>["client"], extra: Partial<Parameters<typeof streamChat>[0]> = {}) =>
  streamChat({ client, message: "oi", conversationId: null, signal: new AbortController().signal, ...extra });

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    assert.ok(e instanceof ApiFailure, `esperava ApiFailure, veio ${String(e)}`);
    return e.input;
  }
  assert.fail("esperava falha");
}

test("caminho feliz em pedaços de 1 byte", async () => {
  const { client, calls } = setup(() => sseResponse(chunk(streamOk, 1)));
  const events = await collect(run(client));
  assert.deepEqual(events.map((e) => e.event), ["meta", "tool", "tool", "token", "token", "token", "done"]);
  assert.equal(calls[0]!.url, "http://api.test/chat");
  assert.equal(calls[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { message: "oi" });
  assert.equal(new Headers(calls[0]!.init.headers).get("accept"), "text/event-stream");
});

test("envia conversationId quando existe", async () => {
  const { client, calls } = setup(() => sseResponse([streamOk]));
  await collect(run(client, { conversationId: CONVERSATION_ID }));
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { message: "oi", conversationId: CONVERSATION_ID });
});

test("\\r\\n e acentos partidos no meio do caractere", async () => {
  const bytes = enc.encode(streamOkCrlf.replace("O aluno", "Ação do aluno"));
  const parts = [bytes.slice(0, 120), bytes.slice(120, 121), bytes.slice(121)];
  const { client } = setup(() => {
    const body = new ReadableStream<Uint8Array>({ start(c) { parts.forEach((p) => c.enqueue(p)); c.close(); } });
    return new Response(body);
  });
  const tokens = (await collect(run(client))).filter((e) => e.event === "token");
  assert.equal((tokens[0] as { text: string }).text, "Ação do aluno ");
});

test("evento desconhecido é ignorado", async () => {
  const { client } = setup(() => sseResponse([streamUnknownEvent]));
  const events = await collect(run(client));
  assert.deepEqual(events.map((e) => e.event), ["meta", "token", "done"]);
});

test("cada erro do stream chega como evento terminal", async () => {
  for (const code of errorCodes) {
    const { client } = setup(() => sseResponse([streamError(code)]));
    const events = await collect(run(client));
    const last = events.at(-1)!;
    assert.equal(last.event, "error");
    assert.equal((last as { code: string }).code, code);
  }
});

test("bytes depois do evento terminal são ignorados", async () => {
  const { client } = setup(() => sseResponse([streamOk, "event: token\ndata: {\"text\":\"lixo\"}\n\n"]));
  const events = await collect(run(client));
  assert.equal(events.at(-1)!.event, "done");
  assert.equal(events.filter((e) => e.event === "token").length, 3);
});

test("corpo termina sem evento terminal → connection_lost", async () => {
  const { client } = setup(() => sseResponse([streamNoTerminal]));
  const input = await failure(collect(run(client)));
  assert.equal(input.source, "client");
  assert.equal((input as { kind: string }).kind, "connection_lost");
});

test("data inválido de evento conhecido → unexpected_response", async () => {
  const { client } = setup(() => sseResponse([streamBadData]));
  const input = await failure(collect(run(client)));
  assert.equal((input as { kind: string }).kind, "unexpected_response");
});

test("prazo total estourado → client_timeout, mesmo com a conexão aberta e silenciosa", async () => {
  const { client } = setup(() => sseResponse([chunk(streamOk, 40)[0]!], { keepOpen: true }));
  let fire: (() => void) | undefined;
  let delay = 0;
  const promise = collect(run(client, { setTimer: (fn, ms) => { fire = fn; delay = ms; return 1; }, clearTimer: () => {} }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(delay, CLIENT_DEADLINE_MS);
  fire!();
  const input = await failure(promise);
  assert.equal((input as { kind: string }).kind, "client_timeout");
});

test("abort pela pessoa encerra sem erro", async () => {
  const { client } = setup(() => sseResponse([chunk(streamOk, 40)[0]!], { keepOpen: true }));
  const controller = new AbortController();
  const promise = collect(run(client, { signal: controller.signal }));
  await new Promise((r) => setTimeout(r, 20));
  controller.abort();
  const events = await promise;
  assert.ok(events.length <= 1);
});

test("abort antes de começar não chama a rede", async () => {
  const { client, calls } = setup(() => sseResponse([streamOk]));
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await collect(run(client, { signal: controller.signal })), []);
  assert.equal(calls.length, 0);
});

test("erros HTTP antes do stream", async () => {
  for (const status of [400, 401, 403, 404, 429, 500] as const) {
    const { client } = setup(() => new Response(JSON.stringify(httpErrors[status]), { status }));
    const input = await failure(collect(run(client)));
    assert.equal(input.source, "http");
    assert.equal((input as { status: number }).status, status);
  }
});

test("rede fora → network", async () => {
  const { client } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
  assert.equal((await failure(collect(run(client)))).source, "network");
});
