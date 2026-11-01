import { test } from "node:test";
import assert from "node:assert/strict";
import { toUserError, type ErrorInput } from "./errors.ts";
import { httpErrors } from "./__fixtures__/http.ts";
import { REQUEST_ID, errorCodes } from "./__fixtures__/stream.ts";

const http = (status: keyof typeof httpErrors): ErrorInput => ({ source: "http", status, body: httpErrors[status] });

test("HTTP: cada status do contrato", () => {
  const expected = {
    400: ["invalid_body", "none"],
    401: ["unauthorized", "reauthenticate"],
    403: ["origin_not_allowed", "none"],
    404: ["conversation_not_found", "new-conversation"],
    429: ["rate_limited", "wait"],
    500: ["server_error", "retry"],
  } as const;
  for (const status of [400, 401, 403, 404, 429, 500] as const) {
    const e = toUserError(http(status));
    assert.deepEqual([e.kind, e.action], expected[status], String(status));
    assert.equal(e.supportCode, REQUEST_ID);
  }
});

test("401 no portão de acesso pede refazer o campo", () => {
  const e = toUserError(http(401), "gate");
  assert.equal(e.title, "Chave incorreta");
  assert.equal(e.action, "none");
});

test("429 usa retryAfterSeconds e 60 por padrão", () => {
  assert.equal(toUserError(http(429)).retryAfterSeconds, 30);
  const e = toUserError({ source: "http", status: 429, body: { requestId: "r", error: "rate_limited" } });
  assert.equal(e.retryAfterSeconds, 60);
  assert.match(e.message, /60 s/);
});

test("HTTP sem corpo válido vira unexpected_response sem código de suporte", () => {
  const e = toUserError({ source: "http", status: 502, body: null });
  assert.equal(e.kind, "unexpected_response");
  assert.equal(e.supportCode, null);
});

test("stream: cada code", () => {
  const kinds = { timeout: "timeout", model_unavailable: "model_unavailable", tools_unavailable: "tools_unavailable", internal_error: "server_error" };
  for (const code of errorCodes) {
    const e = toUserError({ source: "stream", code, requestId: REQUEST_ID });
    assert.equal(e.kind, kinds[code]);
    assert.equal(e.action, "retry");
    assert.equal(e.supportCode, REQUEST_ID);
  }
});

test("rede e falhas do cliente", () => {
  assert.equal(toUserError({ source: "network" }).kind, "network");
  for (const kind of ["connection_lost", "client_timeout", "unexpected_response"] as const) {
    assert.equal(toUserError({ source: "client", kind }).kind, kind);
  }
});

test("nunca repassa texto cru do servidor", () => {
  const all = [
    http(400), http(401), http(403), http(404), http(429), http(500),
    ...errorCodes.map((code) => ({ source: "stream", code, requestId: REQUEST_ID }) as ErrorInput),
    { source: "network" } as ErrorInput,
  ];
  for (const input of all) {
    const e = toUserError(input);
    const text = `${e.title} ${e.message}`;
    assert.doesNotMatch(text, /texto cru|issues|stack|undefined|\[object/i);
    assert.ok(e.title.length > 0 && e.message.length > 0);
  }
});

const httpExport = (error: string, extra: Record<string, unknown> = {}, status = 404) =>
  toUserError({ source: "http", status, body: { requestId: "req-1", error, ...extra } as never }, "export");

test("spec 004: erros de exportação e download têm texto, ação e código de suporte", () => {
  assert.equal(httpExport("file_not_found").message, "Este arquivo não está mais disponível.");
  assert.match(httpExport("result_not_found").message, /Refaça a pergunta e exporte em seguida/);
  assert.match(httpExport("nothing_to_export", {}, 422).message, /não há o que exportar/);
  assert.match(httpExport("export_timeout", {}, 504).message, /demorou mais que o esperado/);
  assert.equal(httpExport("internal_error", {}, 500).message, "Não foi possível gerar o arquivo agora. Tente de novo.");
  for (const e of ["file_not_found", "result_not_found", "nothing_to_export", "export_timeout"]) {
    assert.equal(httpExport(e).supportCode, "req-1");
  }
});

test("spec 004: tamanho e fila usam os números da API", () => {
  const big = httpExport("export_too_large", { rows: 7000, maxRows: 5000 }, 413);
  assert.match(big.message, /7\.000 linhas e o limite por arquivo é 5\.000/);
  const busy = httpExport("export_busy", { retryAfterSeconds: 12 }, 429);
  assert.equal(busy.retryAfterSeconds, 12);
  assert.equal(busy.action, "wait");
  assert.match(busy.message, /em 12 segundos/);
  assert.equal(httpExport("rate_limited", { retryAfterSeconds: 7 }, 429).kind, "export_busy");
});

test("spec 004: fora do contexto de exportação, internal_error segue igual", () => {
  const e = toUserError({ source: "http", status: 500, body: { requestId: "r", error: "internal_error" } });
  assert.equal(e.kind, "server_error");
});

test("spec 004: falha de rede no download usa o texto próprio", () => {
  const e = toUserError({ source: "network" }, "download");
  assert.equal(e.message, "Não foi possível baixar o arquivo. Verifique a conexão e tente de novo.");
  assert.equal(e.action, "retry");
  assert.equal(toUserError({ source: "network" }).kind, "network");
});
