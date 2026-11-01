import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FileCard } from "./FileCard.tsx";
import { toUserError } from "../lib/errors.ts";
import type { FileDescriptor } from "../lib/file-descriptor.ts";
import type { ExportApi } from "../hooks/ExportContext.tsx";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const file: FileDescriptor = {
  id: U, conversationId: U, resultId: U, name: "contas-recebidas-20261031-213015.xlsx", format: "xlsx",
  mime: "application/octet-stream", sizeBytes: 48211, rowCount: 312, includesChart: false, containsFullPersonalData: false,
  createdAt: "2026-10-31T21:30:15.000Z", expiresAt: "2026-10-31T22:00:15.000Z", downloadPath: `/conversations/${U}/exports/${U}`,
};
const api: ExportApi = { conversationId: U, download: async () => {}, request: async () => file, attach: () => {} };
const NOW = Date.parse("2026-10-31T21:30:20.000Z");
const render = (over: Partial<Parameters<typeof FileCard>[0]> = {}) =>
  renderToStaticMarkup(<FileCard file={file} api={api} now={NOW} {...over} />);

test("mostra nome, formato, tamanho, linhas, validade e o botão Baixar", () => {
  const html = render();
  assert.match(html, /contas-recebidas-20261031-213015\.xlsx/);
  assert.match(html, /Excel · 47 KB · 312 linhas/);
  assert.match(html, /Válido até \d{2}:\d{2}/);
  assert.match(html, />Baixar</);
  assert.doesNotMatch(html, /Expira em/);
  assert.match(html, /aria-hidden="true"/);
});

test("nos últimos 5 minutos mostra a contagem regressiva", () => {
  const html = render({ now: Date.parse("2026-10-31T21:57:15.000Z") });
  assert.match(html, /Expira em 03:00/);
});

test("selos: dados pessoais completos e com gráfico", () => {
  const html = render({ file: { ...file, containsFullPersonalData: true, includesChart: true } });
  assert.match(html, /Dados pessoais completos/);
  assert.match(html, /Com gráfico/);
  assert.doesNotMatch(render(), /Dados pessoais completos|Com gráfico/);
});

test("baixando: texto, aria-busy e botão desabilitado", () => {
  const html = render({ initialState: { kind: "downloading" } });
  assert.match(html, /Baixando…/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled/);
});

test("baixado: 'Baixado' e 'Baixar de novo'", () => {
  const html = render({ initialState: { kind: "downloaded" } });
  assert.match(html, />Baixado</);
  assert.match(html, /Baixar de novo/);
});

test("expirado pelo relógio e por 404 têm textos distintos e oferecem Gerar de novo", () => {
  const clock = render({ initialState: { kind: "expired", reason: "clock" } });
  assert.match(clock, /Este link expirou\./);
  assert.match(clock, /Gerar de novo/);
  assert.doesNotMatch(clock, /Válido até/);
  const missing = render({ initialState: { kind: "expired", reason: "missing" } });
  assert.match(missing, /Este arquivo não está mais disponível\./);
});

test("erro mostra a mensagem, o código de suporte e Tentar de novo", () => {
  const error = toUserError({ source: "http", status: 500, body: { requestId: "req-9", error: "internal_error" } }, "download");
  const html = render({ initialState: { kind: "error", error } });
  assert.match(html, /Código de suporte: req-9/);
  assert.match(html, /Tentar de novo/);
  assert.match(html, /role="alert"/);
});

test("gerando de novo mostra o aviso e esconde as ações", () => {
  const html = render({ initialState: { kind: "regenerating" } });
  assert.match(html, /Gerando de novo…/);
  assert.doesNotMatch(html, /<button/);
});

test("sem API, o botão fica desabilitado e não há Gerar de novo", () => {
  const html = render({ api: null, initialState: { kind: "expired", reason: "clock" } });
  assert.doesNotMatch(html, /Gerar de novo/);
  assert.match(render({ api: null }), /disabled/);
});
