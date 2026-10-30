import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createApiClient } from "./client.ts";
import { ApiFailure } from "../lib/failures.ts";
import { httpErrors } from "../lib/__fixtures__/http.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(handler: (url: string, init: RequestInit) => Response | Promise<Response>, key: string | null = "k".repeat(32)) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  let unauthorized = 0;
  const client = createApiClient({
    baseUrl: "http://api.test/",
    getKey: () => key,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers) });
      return handler(url, init);
    }) as typeof fetch,
    onUnauthorized: () => void unauthorized++,
  });
  return { client, calls, unauthorized: () => unauthorized };
}

const Ok = z.object({ ok: z.boolean() });

test("envia Authorization e junta a URL sem barra dupla", async () => {
  const { client, calls } = setup(() => json({ ok: true }));
  assert.deepEqual(await client.request("/conversations", Ok), { ok: true });
  assert.equal(calls[0]!.url, "http://api.test/conversations");
  assert.equal(calls[0]!.headers.get("authorization"), `Bearer ${"k".repeat(32)}`);
});

test("sem chave não envia Authorization", async () => {
  const { client, calls } = setup(() => json({ ok: true }), null);
  await client.request("/x", Ok);
  assert.equal(calls[0]!.headers.has("authorization"), false);
});

test("cada status do contrato vira ApiFailure com o corpo validado", async () => {
  for (const status of [400, 401, 403, 404, 429, 500] as const) {
    const { client } = setup(() => json(httpErrors[status], status));
    await assert.rejects(client.request("/x", Ok), (e: unknown) => {
      assert.ok(e instanceof ApiFailure);
      const { issues: _ignored, ...expected } = httpErrors[status] as Record<string, unknown>;
      assert.deepEqual(e.input, { source: "http", status, body: expected });
      return true;
    });
  }
});

test("401 chama onUnauthorized", async () => {
  const { client, unauthorized } = setup(() => json(httpErrors[401], 401));
  await assert.rejects(client.open("/x"));
  assert.equal(unauthorized(), 1);
});

test("corpo de erro que não é JSON válido vira body null", async () => {
  const { client } = setup(() => new Response("<html>bad gateway</html>", { status: 502 }));
  await assert.rejects(client.open("/x"), (e: unknown) => {
    assert.ok(e instanceof ApiFailure);
    assert.deepEqual(e.input, { source: "http", status: 502, body: null });
    return true;
  });
});

test("rede fora vira network", async () => {
  const { client } = setup(() => Promise.reject(new TypeError("Failed to fetch")));
  await assert.rejects(client.open("/x"), (e: unknown) => e instanceof ApiFailure && e.input.source === "network");
});

test("AbortError passa sem virar ApiFailure", async () => {
  const { client } = setup(() => Promise.reject(new DOMException("abortado", "AbortError")));
  await assert.rejects(client.open("/x"), (e: unknown) => e instanceof DOMException && e.name === "AbortError");
});

test("corpo de sucesso fora do schema ou não JSON vira unexpected_response", async () => {
  const bad = setup(() => json({ ok: "sim" }));
  await assert.rejects(bad.client.request("/x", Ok), (e: unknown) => e instanceof ApiFailure && e.input.source === "client");
  const notJson = setup(() => new Response("oi", { status: 200 }));
  await assert.rejects(notJson.client.request("/x", Ok), (e: unknown) => e instanceof ApiFailure && e.input.source === "client");
});
