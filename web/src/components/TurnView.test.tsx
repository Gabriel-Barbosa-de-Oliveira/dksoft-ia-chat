import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnView } from "./TurnView.tsx";
import type { Turn } from "../lib/chat-reducer.ts";
import { toUserError } from "../lib/errors.ts";

const turn = (over: Partial<Turn> = {}): Turn => ({
  key: "k", question: "Quais pacotes?", status: "done", tools: [], text: "**Resposta**", partial: false,
  error: null, requestId: null, model: null, result: null, charts: [], files: [], ...over,
});
const render = (t: Turn, canCopy = true) => renderToStaticMarkup(<TurnView turn={t} canCopy={canCopy} />);

test("rótulos Você e Assistente, pergunta e resposta renderizada", () => {
  const html = render(turn());
  assert.match(html, />Você</);
  assert.match(html, />Assistente</);
  assert.match(html, /Quais pacotes\?/);
  assert.match(html, /<strong>Resposta<\/strong>/);
});

test("pending mostra Consultando… e marca aria-busy", () => {
  const html = render(turn({ status: "pending", text: "" }));
  assert.match(html, /Consultando…/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Copiar/);
});

test("streaming mostra o texto parcial sem Copiar", () => {
  const html = render(turn({ status: "streaming", text: "O alu" }));
  assert.match(html, /O alu/);
  assert.doesNotMatch(html, /Consultando…/);
  assert.doesNotMatch(html, /Copiar/);
});

test("concluído tem Copiar e modelo discreto", () => {
  const html = render(turn({ model: "modelo-x" }));
  assert.match(html, /Copiar/);
  assert.match(html, /modelo-x/);
});

test("sem API de área de transferência não há Copiar", () => {
  assert.doesNotMatch(render(turn(), false), /Copiar/);
});

test("concluído sem texto não tem Copiar", () => {
  assert.doesNotMatch(render(turn({ text: "" })), /Copiar/);
});

test("parcial mostra o aviso visível", () => {
  const html = render(turn({ partial: true }));
  assert.match(html, /Resultado parcial/);
  assert.match(html, /A lista está incompleta/);
});

test("interrompida avisa que não será guardada", () => {
  const html = render(turn({ status: "interrupted", text: "meio" }));
  assert.match(html, /Resposta interrompida/);
  assert.match(html, /não será guardada no histórico/);
  assert.match(html, /meio/);
});

test("erro mostra título e mensagem e mantém o texto parcial", () => {
  const error = toUserError({ source: "stream", code: "timeout", requestId: "r1" });
  const html = render(turn({ status: "error", text: "parcial", error }));
  assert.match(html, /A resposta demorou demais/);
  assert.match(html, /parcial/);
  assert.match(html, /role="alert"/);
});

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const fileOf = (name: string) => ({
  id: crypto.randomUUID(), conversationId: U, resultId: U, name, format: "pdf" as const, mime: "application/pdf", sizeBytes: 1000, rowCount: 3,
  includesChart: false, containsFullPersonalData: false, createdAt: "2026-10-31T21:30:15.000Z", expiresAt: "2099-10-31T22:00:15.000Z", downloadPath: "/p",
});

test("spec 004: turno sem arquivos renderiza como antes; com 2 arquivos, 2 cartões na ordem", () => {
  assert.doesNotMatch(render(turn()), /aria-label="Arquivo /);
  const html = render(turn({ files: [fileOf("a.pdf"), fileOf("b.pdf")] }));
  assert.equal((html.match(/aria-label="Arquivo /g) ?? []).length, 2);
  assert.ok(html.indexOf("a.pdf") < html.indexOf("b.pdf"));
});

const chartOf = (title: string) => ({
  id: crypto.randomUUID(), type: "bar" as const, title, valueKind: "integer" as const, categories: ["a", "b"],
  series: [{ name: "s", values: [1, 2] }], summary: "Resumo do gráfico.", resultId: U, partial: false,
});

test("spec 004: ordem texto → gráficos → arquivos; turno de histórico mostra os gráficos", () => {
  const html = render(turn({ charts: [chartOf("Gráfico A")], files: [fileOf("a.pdf")] }));
  assert.ok(html.indexOf("Resposta") < html.indexOf("Gráfico A"));
  assert.ok(html.indexOf("Gráfico A") < html.indexOf("a.pdf"));
  assert.doesNotMatch(render(turn()), /<figure/);
  assert.match(render(turn({ charts: [chartOf("Do histórico")] })), /Do histórico/);
});
