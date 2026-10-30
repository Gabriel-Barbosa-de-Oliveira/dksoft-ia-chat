import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "./AppShell.tsx";

const render = (aside?: boolean) =>
  renderToStaticMarkup(
    <AppShell onSignOut={() => {}} aside={aside ? <p>histórico</p> : undefined}>
      <p>conversa</p>
    </AppShell>,
  );

test("um único h1 e pontos de referência corretos", () => {
  const html = render(true);
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.match(html, /<header class="nav"/);
  assert.match(html, /<aside[^>]*aria-label="Histórico de conversas"/);
  assert.match(html, /<main id="conversa"/);
});

test("o link de pular aponta para o id do main", () => {
  const html = render();
  assert.match(html, /<a href="#conversa" class="skip-link">Pular para a conversa<\/a>/);
  assert.doesNotMatch(html, /<aside/);
});

test("botão Sair tem rótulo visível", () => {
  assert.match(render(), /Sair<svg/);
});
