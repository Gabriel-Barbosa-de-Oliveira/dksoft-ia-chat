import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiClient } from "./client.ts";
import { downloadFile } from "./exports.ts";
import { ApiFailure } from "../lib/failures.ts";

const file = { downloadPath: "/conversations/c/exports/f", mime: "application/pdf" };

function client(respond: (url: string, init: RequestInit) => Response | Promise<Response>, seen: { url?: string; auth?: string | null } = {}) {
  return createApiClient({
    baseUrl: "https://api.test",
    getKey: () => "segredo",
    fetch: (async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.auth = new Headers(init.headers).get("authorization");
      return respond(url, init);
    }) as typeof fetch,
  });
}

test("download envia a chave no cabeçalho, nunca na URL, e devolve o Blob", async () => {
  const seen: { url?: string; auth?: string | null } = {};
  const blob = await downloadFile(client(() => new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "application/pdf" } }), seen), file);
  assert.equal(seen.auth, "Bearer segredo");
  assert.equal(seen.url, "https://api.test/conversations/c/exports/f");
  assert.ok(!seen.url!.includes("segredo"));
  assert.equal(blob.size, 3);
  assert.equal(blob.type, "application/pdf");
});

test("resposta sem content-type usa o mime do descritor", async () => {
  const blob = await downloadFile(client(() => new Response(new Uint8Array([1]))), file);
  assert.equal(blob.type, "application/pdf");
});

test("404 vira ApiFailure com file_not_found; 401 avisa e falha", async () => {
  await assert.rejects(
    downloadFile(client(() => Response.json({ requestId: "r", error: "file_not_found" }, { status: 404 })), file),
    (e) => e instanceof ApiFailure && e.input.source === "http" && e.input.body?.error === "file_not_found",
  );
  let unauthorized = 0;
  const c = createApiClient({
    baseUrl: "https://api.test",
    getKey: () => "k",
    fetch: (async () => Response.json({ requestId: "r", error: "unauthorized" }, { status: 401 })) as typeof fetch,
    onUnauthorized: () => void unauthorized++,
  });
  await assert.rejects(downloadFile(c, file), ApiFailure);
  assert.equal(unauthorized, 1);
});

test("falha de rede vira ApiFailure de rede", async () => {
  const c = client(() => {
    throw new TypeError("fail");
  });
  await assert.rejects(downloadFile(c, file), (e) => e instanceof ApiFailure && e.input.source === "network");
});

import { requestExport } from "./exports.ts";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const descriptor = { id: U, conversationId: U, resultId: U, name: "a.xlsx", format: "xlsx", mime: "m", sizeBytes: 1, rowCount: 2, includesChart: false, containsFullPersonalData: false, createdAt: "x", expiresAt: "y", downloadPath: "/p" };

test("requestExport faz POST /exports sem opção de dados completos e valida a resposta", async () => {
  let sent: { url?: string; init?: RequestInit } = {};
  const c = client((url, init) => {
    sent = { url, init };
    return Response.json({ requestId: "r", file: descriptor }, { status: 201 });
  });
  const file = await requestExport(c, { conversationId: U, resultId: U, format: "xlsx" });
  assert.equal(file.name, "a.xlsx");
  assert.equal(sent.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(sent.init?.body)), { conversationId: U, resultId: U, format: "xlsx" });
  const withChart = client((_u, init) => {
    assert.equal(JSON.parse(String(init.body)).chartId, U);
    return Response.json({ requestId: "r", file: descriptor }, { status: 201 });
  });
  await requestExport(withChart, { conversationId: U, resultId: U, format: "pdf", chartId: U });
});

test("requestExport: resposta fora do contrato e erros da API", async () => {
  await assert.rejects(requestExport(client(() => Response.json({ file: {} })), { conversationId: U, resultId: U, format: "pdf" }), ApiFailure);
  await assert.rejects(
    requestExport(client(() => Response.json({ requestId: "r", error: "export_busy", retryAfterSeconds: 9 }, { status: 429 })), { conversationId: U, resultId: U, format: "pdf" }),
    (e) => e instanceof ApiFailure && e.input.source === "http" && e.input.body?.error === "export_busy",
  );
});
