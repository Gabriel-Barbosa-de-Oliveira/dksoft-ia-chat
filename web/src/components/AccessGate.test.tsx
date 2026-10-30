import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AccessGate } from "./AccessGate.tsx";
import { toUserError } from "../lib/errors.ts";

const noop = () => {};

test("h1, campo de senha rotulado e botão principal", () => {
  const html = renderToStaticMarkup(<AccessGate onSubmit={noop} validating={false} error={null} />);
  assert.match(html, /<h1[^>]*>Acesso ao chat<\/h1>/);
  const id = /<label for="([^"]+)">Chave de acesso<\/label>/.exec(html)?.[1];
  assert.ok(id && html.includes(`id="${id}"`));
  assert.match(html, /type="password"/);
  assert.match(html, /autoComplete="off"|autocomplete="off"/);
  assert.match(html, /btn-primary[^>]*>Entrar</);
  assert.doesNotMatch(html, /aria-describedby/);
});

test("erro fica ligado ao campo por aria-describedby", () => {
  const error = toUserError({ source: "http", status: 401, body: { requestId: "r1", error: "unauthorized" } }, "gate");
  const html = renderToStaticMarkup(<AccessGate onSubmit={noop} validating={false} error={error} />);
  const errorId = /aria-describedby="([^"]+)"/.exec(html)?.[1];
  assert.ok(errorId);
  assert.ok(html.includes(`id="${errorId}"`));
  assert.match(html, /Chave incorreta/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /Código de suporte: r1/);
});

test("validando: rótulo Verificando… e aria-busy", () => {
  const html = renderToStaticMarkup(<AccessGate onSubmit={noop} validating error={null} />);
  assert.match(html, /aria-busy="true"[^>]*>Verificando…/);
});

test("sessão expirada mostra o aviso", () => {
  const html = renderToStaticMarkup(<AccessGate onSubmit={noop} validating={false} error={null} reason="session" />);
  assert.match(html, /Sua sessão expirou/);
});
