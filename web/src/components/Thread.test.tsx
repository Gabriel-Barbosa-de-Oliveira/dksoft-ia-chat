import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Thread } from "./Thread.tsx";
import type { Turn } from "../lib/chat-reducer.ts";

const turn = (key: string): Turn => ({
  key, question: `P ${key}`, status: "done", tools: [], text: `R ${key}`, partial: false, error: null, requestId: null, model: null,
});

test("renderiza um turno por item, em ordem, dentro de um log nomeado", () => {
  const html = renderToStaticMarkup(<Thread turns={[turn("a"), turn("b")]} />);
  assert.match(html, /role="log"[^>]*aria-label="Conversa"|aria-label="Conversa"[^>]*role="log"/);
  assert.ok(html.indexOf("P a") < html.indexOf("P b"));
});

test("acompanhando (estado inicial) não mostra Ir para o fim", () => {
  assert.doesNotMatch(renderToStaticMarkup(<Thread turns={[turn("a")]} />), /Ir para o fim/);
});
