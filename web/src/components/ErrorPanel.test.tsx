import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorPanel } from "./ErrorPanel.tsx";
import { toUserError, type ErrorInput } from "../lib/errors.ts";

const noop = () => {};
const http = (status: number, error: string, extra: object = {}): ErrorInput => ({
  source: "http", status, body: { requestId: "req-123", error, ...extra } as never,
});
const render = (input: ErrorInput, props: Partial<Parameters<typeof ErrorPanel>[0]> = {}) =>
  renderToStaticMarkup(<ErrorPanel error={toUserError(input)} onRetry={noop} onNewConversation={noop} onReauthenticate={noop} {...props} />);

test("retry: botão Tentar novamente e nenhum rastro técnico", () => {
  const html = render({ source: "stream", code: "timeout", requestId: "req-123" });
  assert.match(html, /A resposta demorou demais/);
  assert.match(html, /Tentar novamente/);
  assert.doesNotMatch(html, /Iniciar nova conversa|Informar a chave/);
  assert.doesNotMatch(html, /stack|undefined|\[object/i);
});

test("new-conversation e reauthenticate", () => {
  assert.match(render(http(404, "conversation_not_found")), /Iniciar nova conversa/);
  assert.match(render(http(401, "unauthorized")), /Informar a chave de novo/);
});

test("none: sem botão de ação (origem não autorizada, pergunta inválida)", () => {
  for (const input of [http(403, "origin_not_allowed"), http(400, "invalid_body")]) {
    const html = render(input);
    assert.doesNotMatch(html, /Tentar novamente|Iniciar nova conversa|Informar a chave/);
  }
});

test("wait: contagem regressiva e liberação ao zerar", () => {
  const input = http(429, "rate_limited", { retryAfterSeconds: 30 });
  assert.match(render(input, { countdown: 12 }), /Você pode enviar de novo em 12 s\./);
  assert.match(render(input, { countdown: 0 }), /Você já pode enviar de novo\./);
  assert.doesNotMatch(render(input), /Você pode enviar de novo/);
});

test("código de suporte presente só quando existe", () => {
  assert.match(render(http(500, "internal_error")), /Código de suporte: <span class="code">req-123<\/span>/);
  assert.doesNotMatch(render({ source: "network" }), /Código de suporte/);
});

test("o erro nunca mostra o texto cru do servidor", () => {
  const html = render({ source: "stream", code: "internal_error", requestId: "r" });
  assert.doesNotMatch(html, /TEXTO CRU/);
});
