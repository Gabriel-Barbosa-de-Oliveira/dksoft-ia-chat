import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionStatus, conversationListReducer, initialList, type ConversationListAction } from "./conversation-list.ts";
import { toUserError } from "./errors.ts";
import { conversationsFull, conversationsShort } from "./__fixtures__/http.ts";

const run = (actions: ConversationListAction[], from = initialList) => actions.reduce(conversationListReducer, from);

test("primeira página cheia: ready com hasMore", () => {
  const s = run([{ type: "LOAD_OK", page: conversationsFull }]);
  assert.equal(s.status, "ready");
  assert.equal(s.items.length, 20);
  assert.equal(s.hasMore, true);
});

test("primeira página vazia: empty", () => {
  const s = run([{ type: "LOAD_OK", page: { conversations: [], limit: 20, offset: 0 } }]);
  assert.equal(s.status, "empty");
  assert.equal(s.hasMore, false);
});

test("carregar mais até a página curta, sem duplicar", () => {
  let s = run([{ type: "LOAD_OK", page: conversationsFull }, { type: "LOAD_MORE_START" }]);
  assert.equal(s.loadingMore, true);
  s = run([{ type: "LOAD_MORE_OK", page: { ...conversationsShort, conversations: [...conversationsFull.conversations.slice(18), ...conversationsShort.conversations.map((c, i) => ({ ...c, id: `99999999-0000-4000-8000-00000000000${i}` }))] } }], s);
  assert.equal(s.items.length, 23);
  assert.equal(new Set(s.items.map((c) => c.id)).size, 23);
  assert.equal(s.hasMore, false);
  assert.equal(s.loadingMore, false);
});

test("erro ao carregar mais mantém os itens", () => {
  const error = toUserError({ source: "network" });
  const s = run([{ type: "LOAD_OK", page: conversationsFull }, { type: "LOAD_MORE_START" }, { type: "LOAD_MORE_ERROR", error }]);
  assert.equal(s.items.length, 20);
  assert.equal(s.moreError, error);
  assert.equal(s.status, "ready");
});

test("erro na primeira carga e recarga", () => {
  const error = toUserError({ source: "network" });
  const failed = run([{ type: "LOAD_ERROR", error }]);
  assert.equal(failed.status, "error");
  assert.equal(failed.error, error);
  assert.equal(run([{ type: "LOAD_START" }], failed).status, "loading");
});

test("REFRESH_OK troca os itens sem passar por loading", () => {
  const s = run([{ type: "LOAD_OK", page: conversationsShort }, { type: "REFRESH_OK", page: conversationsFull }]);
  assert.equal(s.status, "ready");
  assert.equal(s.items.length, 20);
});

test("LOAD_MORE_START duplicado não muda o estado", () => {
  const s = run([{ type: "LOAD_OK", page: conversationsFull }, { type: "LOAD_MORE_START" }]);
  assert.equal(conversationListReducer(s, { type: "LOAD_MORE_START" }), s);
});

test("connectionStatus deriva do estado da lista", () => {
  assert.equal(connectionStatus("loading"), "connecting");
  assert.equal(connectionStatus("ready"), "connected");
  assert.equal(connectionStatus("empty"), "connected");
  assert.equal(connectionStatus("error"), "offline");
});
