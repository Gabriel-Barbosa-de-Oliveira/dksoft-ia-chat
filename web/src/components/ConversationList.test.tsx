import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRouter } from "react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { ConversationList, type ConversationListProps } from "./ConversationList.tsx";
import { initialList, type ConversationListState } from "../lib/conversation-list.ts";
import { toUserError } from "../lib/errors.ts";
import { conversationsFull, conversationsShort } from "../lib/__fixtures__/http.ts";

const NOW = Date.parse("2026-10-30T15:00:00.000Z");
const ready = (page: typeof conversationsFull, hasMore: boolean): ConversationListState => ({
  ...initialList,
  status: "ready",
  items: page.conversations,
  hasMore,
});

function render(state: ConversationListState, over: Partial<ConversationListProps> = {}) {
  const props: ConversationListProps = {
    state, currentId: null, now: NOW, preview: () => undefined, onVisible() {}, onNew() {}, onOpen() {}, onLoadMore() {}, onRetry() {},
    ...over,
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <ConversationList {...props} />
    </MemoryRouter>,
  );
}

test("carregando: esqueleto de 5 linhas e botão Nova conversa", () => {
  const html = render(initialList);
  assert.equal((html.match(/class="bar"/g) ?? []).length, 5);
  assert.match(html, /Nova conversa/);
  assert.match(html, />Conversas</);
});

test("vazio: mensagem com a próxima ação", () => {
  const html = render({ ...initialList, status: "empty" });
  assert.match(html, /Nenhuma conversa ainda\. Faça sua primeira pergunta\./);
  assert.match(html, /Nova conversa/);
});

test("erro: aviso no painel com Tentar novamente", () => {
  const html = render({ ...initialList, status: "error", error: toUserError({ source: "network" }) });
  assert.match(html, /Sem conexão/);
  assert.match(html, /Tentar novamente/);
  assert.match(html, /role="alert"/);
});

test("pronto: links nativos para /c/:id, com data e sem prévia usa rótulo por data", () => {
  const html = render(ready(conversationsShort as never, false));
  assert.equal((html.match(/<a /g) ?? []).length, 3);
  assert.match(html, /href="\/c\/00000000-0000-4000-8000-000000000000"/);
  assert.match(html, /Conversa de /);
  assert.doesNotMatch(html, /Carregar mais/);
});

test("com prévia, mostra o trecho e a data", () => {
  const html = render(ready(conversationsShort as never, false), { preview: () => "Quais pacotes existem?" });
  assert.match(html, /Quais pacotes existem\?/);
  assert.doesNotMatch(html, /Conversa de /);
});

test("a conversa aberta é marcada com aria-current", () => {
  const id = conversationsShort.conversations[1]!.id;
  const html = render(ready(conversationsShort as never, false), { currentId: id });
  assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
  assert.match(html, new RegExp(`aria-current="true"[^>]*>|href="/c/${id}"[^>]*aria-current="true"`));
});

test("Carregar mais só com hasMore", () => {
  assert.match(render(ready(conversationsFull as never, true)), /Carregar mais/);
  assert.doesNotMatch(render(ready(conversationsFull as never, false)), /Carregar mais/);
});
