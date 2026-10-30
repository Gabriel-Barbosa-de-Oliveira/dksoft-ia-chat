import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell, type AppShellProps } from "./AppShell.tsx";

const render = (over: Partial<AppShellProps> = {}) =>
  renderToStaticMarkup(
    <AppShell title="Nova conversa" onSignOut={() => {}} aside={<p>histórico</p>} {...over}>
      <p>conversa</p>
    </AppShell>,
  );

test("um único h1 e pontos de referência corretos", () => {
  const html = render();
  assert.equal((html.match(/<h1/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Nova conversa<\/h1>/);
  assert.match(html, /<aside[^>]*aria-label="Histórico de conversas"/);
  assert.match(html, /<main id="conversa"/);
});

test("o link de pular aponta para o id do main", () => {
  const html = render();
  assert.match(html, /<a href="#conversa" class="skip-link">Pular para a conversa<\/a>/);
});

test("botão Sair tem rótulo visível", () => {
  assert.match(render(), /<\/svg>Sair<\/button>/);
});

test("mostra a sessão aberta e o estado da conexão só quando informados", () => {
  assert.doesNotMatch(render(), /Sessão \d/);
  assert.doesNotMatch(render(), /Conectado/);
  const html = render({ sessionLabel: "03", connection: "connected" });
  assert.match(html, /Sessão 03/);
  assert.match(html, /Conectado/);
});

test("menu de tela estreita aponta para a barra e nasce fechado", () => {
  const html = render();
  assert.match(html, /aria-label="Abrir sessões" aria-expanded="false" aria-controls="sidebar"/);
  assert.match(html, /<aside id="sidebar"/);
});
