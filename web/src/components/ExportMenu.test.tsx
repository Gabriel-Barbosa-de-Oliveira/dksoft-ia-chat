import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ExportMenu, MASKED_NOTICE, type ExportMenuProps } from "./ExportMenu.tsx";
import { toUserError } from "../lib/errors.ts";
import type { ExportApi } from "../hooks/ExportContext.tsx";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const api: ExportApi = { conversationId: U, download: async () => {}, request: async () => { throw new Error("não deveria pedir"); }, attach: () => {} };
const result = { resultId: U, label: "Contas", rows: 3, totalRows: 3, capped: false, expiresAt: "2099-01-01T00:00:00.000Z" };
const chart = { id: U, type: "bar" as const, title: "t", valueKind: "integer" as const, categories: ["a"], series: [{ name: "s", values: [1] }], summary: "r", resultId: U, partial: false };
const render = (over: Partial<ExportMenuProps> = {}, charts: ExportMenuProps["turn"]["charts"] = []) =>
  renderToStaticMarkup(<ExportMenu turn={{ key: "k", charts, result }} api={api} {...over} />);

test("fechado: só o botão Exportar com aria-haspopup e aria-expanded=false", () => {
  const html = render();
  assert.match(html, />Exportar</);
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /role="menu"/);
});

test("aberto: três itens, aviso de mascaramento e aria-expanded=true", () => {
  const html = render({ initialOpen: true });
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /role="menu"/);
  assert.equal((html.match(/role="menuitem"/g) ?? []).length, 3);
  for (const label of ["PDF", "Excel (.xlsx)", "Word (.docx)"]) assert.ok(html.includes(`>${label}<`), label);
  assert.ok(html.includes(MASKED_NOTICE));
  assert.doesNotMatch(html, /Incluir gráfico/);
  assert.doesNotMatch(html, /completo(s)? por padrão|CPF completo/);
});

test("com gráfico no turno aparece 'Incluir gráfico', desmarcado por padrão", () => {
  const html = render({ initialOpen: true }, [chart]);
  assert.match(html, /role="menuitemcheckbox"/);
  assert.match(html, /aria-checked="false"/);
  assert.match(html, /Incluir gráfico/);
});

test("gerando: botão 'Gerando…' com aria-busy e aria-disabled", () => {
  const html = render({ initialState: { status: "generating", format: "xlsx" } });
  assert.match(html, /Gerando…/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /aria-disabled="true"/);
});

test("cada erro aparece com o texto do contrato e o código de suporte", () => {
  const mk = (error: string, extra: Record<string, unknown> = {}) =>
    toUserError({ source: "http", status: 400, body: { requestId: "req-5", error, ...extra } as never }, "export");
  const too = render({ initialState: { status: "error", error: mk("export_too_large", { rows: 7000, maxRows: 5000 }) } });
  assert.match(too, /7\.000 linhas e o limite por arquivo é 5\.000\. Reduza o período/);
  assert.match(too, /req-5/);
  const gone = render({ initialState: { status: "error", error: mk("result_not_found") } });
  assert.match(gone, /Refaça a pergunta e exporte em seguida/);
  assert.doesNotMatch(gone, /aria-haspopup/, "sem dados vivos o botão some");
  const timeout = render({ initialState: { status: "error", error: mk("export_timeout") } });
  assert.match(timeout, /Tentar novamente/);
});

test("fila ocupada bloqueia o botão e mostra a contagem", () => {
  const error = toUserError({ source: "http", status: 429, body: { requestId: "r", error: "export_busy", retryAfterSeconds: 7 } }, "export");
  const html = render({ initialState: { status: "error", error } });
  assert.match(html, /Aguarde 7 s/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /Há outras exportações em andamento\. Tente de novo em 7 segundos\./);
});
