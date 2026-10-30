import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAccessKey } from "./access.ts";
import { conversationsShort, httpErrors } from "../lib/__fixtures__/http.ts";

const KEY = "chave-secreta-de-32-caracteres-xx";
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function run(respond: () => Response | Promise<Response>) {
  const calls: Array<{ url: string; auth: string | null }> = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    calls.push({ url, auth: new Headers(init.headers).get("authorization") });
    return respond();
  }) as typeof fetch;
  return { calls, result: validateAccessKey({ baseUrl: "http://api.test", key: KEY, fetch: fetchFake }) };
}

test("200 aceita e a chave só vai no cabeçalho", async () => {
  const { calls, result } = run(() => json(conversationsShort));
  assert.deepEqual(await result, { ok: true });
  assert.equal(calls[0]!.url, "http://api.test/conversations?limit=1");
  assert.equal(calls[0]!.auth, `Bearer ${KEY}`);
  assert.doesNotMatch(calls[0]!.url, new RegExp(KEY));
});

test("401 → Chave incorreta", async () => {
  const r = await run(() => json(httpErrors[401], 401)).result;
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.error.title, "Chave incorreta");
    assert.doesNotMatch(JSON.stringify(r.error), new RegExp(KEY));
  }
});

test("demais falhas viram o erro correspondente", async () => {
  const kinds: Array<[() => Response | Promise<Response>, string]> = [
    [() => json(httpErrors[403], 403), "origin_not_allowed"],
    [() => json(httpErrors[429], 429), "rate_limited"],
    [() => json(httpErrors[500], 500), "server_error"],
    [() => Promise.reject(new TypeError("x")), "network"],
    [() => json({ lixo: true }), "unexpected_response"],
  ];
  for (const [respond, kind] of kinds) {
    const r = await run(respond).result;
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.kind, kind);
  }
});
