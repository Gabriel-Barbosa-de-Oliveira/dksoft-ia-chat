import { test } from "node:test";
import assert from "node:assert/strict";
import { getMessages, listConversations } from "./conversations.ts";
import { createApiClient } from "./client.ts";
import { ApiFailure } from "../lib/failures.ts";
import { conversationsFull, conversationsShort, httpErrors, messages } from "../lib/__fixtures__/http.ts";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function setup(respond: () => Response) {
  const urls: string[] = [];
  const client = createApiClient({
    baseUrl: "http://api.test",
    getKey: () => "k",
    fetch: (async (url: string) => (urls.push(url), respond())) as typeof fetch,
  });
  return { client, urls };
}

test("listConversations manda limit e offset e valida a página", async () => {
  const { client, urls } = setup(() => json(conversationsFull));
  const page = await listConversations(client, { limit: 20, offset: 40 });
  assert.equal(urls[0], "http://api.test/conversations?limit=20&offset=40");
  assert.equal(page.conversations.length, 20);
  const short = setup(() => json(conversationsShort));
  assert.equal((await listConversations(short.client, { limit: 20, offset: 0 })).conversations.length, 3);
});

test("listConversations propaga 401", async () => {
  const { client } = setup(() => json(httpErrors[401], 401));
  await assert.rejects(listConversations(client, { limit: 20, offset: 0 }), (e: unknown) => e instanceof ApiFailure && e.input.source === "http");
});

test("getMessages devolve as mensagens", async () => {
  const { client, urls } = setup(() => json(messages));
  const res = await getMessages(client, messages.conversationId);
  assert.equal(urls[0], `http://api.test/conversations/${messages.conversationId}/messages`);
  assert.equal(res.messages.length, 2);
});

test("getMessages 404", async () => {
  const { client } = setup(() => json(httpErrors[404], 404));
  await assert.rejects(getMessages(client, messages.conversationId), (e: unknown) => e instanceof ApiFailure && e.input.source === "http" && e.input.status === 404);
});

test("id que não é UUID não chama a rede", async () => {
  const { client, urls } = setup(() => json(messages));
  await assert.rejects(getMessages(client, "abc"), (e: unknown) => e instanceof ApiFailure && e.input.source === "client" && e.input.kind === "conversation_not_found");
  await assert.rejects(getMessages(client, "../../etc/passwd"));
  assert.equal(urls.length, 0);
});
