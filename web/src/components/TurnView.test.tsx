import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { TurnView } from "./TurnView.tsx";
import type { Turn } from "../lib/chat-reducer.ts";
import { toUserError } from "../lib/errors.ts";

const turn = (over: Partial<Turn> = {}): Turn => ({
  key: "k", question: "Quais pacotes?", status: "done", tools: [], text: "**Resposta**", partial: false,
  error: null, requestId: null, model: null, ...over,
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
