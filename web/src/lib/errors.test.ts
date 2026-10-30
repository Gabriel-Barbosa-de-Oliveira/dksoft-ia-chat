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
