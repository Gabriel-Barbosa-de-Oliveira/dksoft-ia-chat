import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "./Markdown.tsx";

const render = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

test("<script> e atributos de evento saem como texto escapado", () => {
  const html = render('Olá <script>alert(1)</script> <img src=x onerror="alert(2)">');
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<img/i);
  assert.match(html, /&lt;script&gt;/);
});

test("javascript: não vira link ativo", () => {
  const html = render("[clique](javascript:alert(1)) e [data](data:text/html;base64,AAAA)");
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.doesNotMatch(html, /href="data:/i);
});

test("link externo abre em outra aba com rel seguro", () => {
  const html = render("[DKSOFT](https://example.com/x)");
  assert.match(html, /href="https:\/\/example\.com\/x"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("tabela GFM vem dentro de um bloco rolável, focável e nomeado", () => {
  const html = render("| Aluno | Valor |\n|---|---|\n| Ana | 10 |\n");
  assert.match(html, /<div class="tableWrap" role="region" aria-label="Tabela da resposta" tabindex="0"><table class="table">/);
  assert.match(html, /<th>Aluno<\/th>/);
});

test("formatação básica", () => {
  const html = render("**negrito**\n\n- a\n- b\n\n`código`");
  assert.match(html, /<strong>negrito<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<code>código<\/code>/);
});
