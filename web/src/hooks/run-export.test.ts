import { test } from "node:test";
import assert from "node:assert/strict";
import { runExport } from "./run-export.ts";
import type { ExportApi } from "./ExportContext.tsx";
import { ApiFailure } from "../lib/failures.ts";
import type { FileDescriptor } from "../lib/file-descriptor.ts";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const file: FileDescriptor = { id: U, conversationId: U, resultId: U, name: "a.xlsx", format: "xlsx", mime: "m", sizeBytes: 1, rowCount: 2, includesChart: false, containsFullPersonalData: false, createdAt: "x", expiresAt: "y", downloadPath: "/p" };

function setup(request: ExportApi["request"]) {
  const said: string[] = [];
  const attached: Array<[string, FileDescriptor]> = [];
  const requests: unknown[] = [];
  const api: ExportApi = {
    conversationId: U,
    download: async () => {},
    request: async (input) => (requests.push(input), request(input)),
    attach: (k, f) => void attached.push([k, f]),
  };
  const announcer = { announce: (t: string) => void said.push(`a:${t}`), alert: (t: string) => void said.push(`!:${t}`) };
  return { api, announcer, said, attached, requests };
}

test("sucesso anexa o arquivo ao turno e anuncia", async () => {
  const s = setup(async () => file);
  const out = await runExport({ api: s.api, announcer: s.announcer, turnKey: "k1", resultId: U, format: "xlsx" });
  assert.equal(out.ok, true);
  assert.deepEqual(s.attached, [["k1", file]]);
  assert.deepEqual(s.said, ["a:Arquivo pronto: a.xlsx."]);
  assert.deepEqual(s.requests, [{ resultId: U, format: "xlsx" }]);
});

test("chartId só vai no pedido quando informado", async () => {
  const s = setup(async () => file);
  await runExport({ api: s.api, announcer: s.announcer, turnKey: "k", resultId: U, format: "pdf", chartId: U });
  await runExport({ api: s.api, announcer: s.announcer, turnKey: "k", resultId: U, format: "pdf", chartId: null });
  assert.deepEqual(s.requests, [{ resultId: U, format: "pdf", chartId: U }, { resultId: U, format: "pdf" }]);
});

test("cada erro vira UserError com o texto do contrato, alerta e nada é anexado", async () => {
  const cases: Array<[string, Record<string, unknown>, RegExp]> = [
    ["export_too_large", { rows: 7000, maxRows: 5000 }, /7\.000 linhas e o limite por arquivo é 5\.000/],
    ["result_not_found", {}, /Refaça a pergunta e exporte em seguida/],
    ["nothing_to_export", {}, /não há o que exportar/],
    ["export_busy", { retryAfterSeconds: 9 }, /em 9 segundos/],
    ["export_timeout", {}, /demorou mais que o esperado/],
    ["internal_error", {}, /Não foi possível gerar o arquivo agora/],
  ];
  for (const [error, extra, text] of cases) {
    const s = setup(async () => {
      throw new ApiFailure({ source: "http", status: 500, body: { requestId: "req-7", error, ...extra } as never });
    });
    const out = await runExport({ api: s.api, announcer: s.announcer, turnKey: "k", resultId: U, format: "pdf" });
    assert.equal(out.ok, false, error);
    if (!out.ok) {
      assert.match(out.error.message, text, error);
      assert.equal(out.error.supportCode, "req-7");
    }
    assert.equal(s.attached.length, 0);
    assert.match(s.said[0]!, /^!:/);
  }
});

test("falha de rede e resposta inesperada também viram erro de usuário", async () => {
  const net = setup(async () => {
    throw new ApiFailure({ source: "network" });
  });
  const out = await runExport({ api: net.api, announcer: net.announcer, turnKey: "k", resultId: U, format: "pdf" });
  assert.equal(out.ok === false && out.error.kind, "network");
  const odd = setup(async () => {
    throw new Error("boom");
  });
  const out2 = await runExport({ api: odd.api, announcer: odd.announcer, turnKey: "k", resultId: U, format: "pdf" });
  assert.equal(out2.ok === false && out2.error.kind, "unexpected_response");
});
