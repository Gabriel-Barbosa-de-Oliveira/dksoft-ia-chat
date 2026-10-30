import { test } from "node:test";
import assert from "node:assert/strict";
import { formatConversationDate, previewOf } from "./conversation-label.ts";

test("previewOf normaliza espaços e não corta o curto", () => {
  assert.equal(previewOf("  Quais   pacotes\n existem? "), "Quais pacotes existem?");
});

test("previewOf corta em até 60 sem partir palavra", () => {
  const text = "Quais parcelas em aberto o aluno de matrícula 1234 tem neste mês de outubro?";
  const out = previewOf(text);
  assert.ok(out.length <= 60);
  assert.ok(out.endsWith("…"));
  assert.ok(text.startsWith(out.slice(0, -1)));
  assert.doesNotMatch(out, /\s…$/);
  assert.equal(out.slice(0, -1).split(" ").every((w) => text.split(" ").includes(w)), true);
});

test("previewOf corta duro quando não há espaço", () => {
  const out = previewOf("a".repeat(100));
  assert.equal(out.length, 60);
  assert.ok(out.endsWith("…"));
});

const TZ = "America/Sao_Paulo";
const now = new Date("2026-10-30T15:00:00.000Z"); // 12:00 em São Paulo

test("hoje, ontem, mesmo ano e outro ano", () => {
  assert.equal(formatConversationDate("2026-10-30T17:32:00.000Z", now, "pt-BR", TZ), "Hoje, 14:32");
  assert.equal(formatConversationDate("2026-10-29T12:10:00.000Z", now, "pt-BR", TZ), "Ontem, 09:10");
  assert.equal(formatConversationDate("2026-10-28T19:45:00.000Z", now, "pt-BR", TZ), "28 out, 16:45");
  assert.equal(formatConversationDate("2025-10-28T19:45:00.000Z", now, "pt-BR", TZ), "28 out 2025, 16:45");
});

test("data inválida devolve vazio", () => {
  assert.equal(formatConversationDate("lixo", now, "pt-BR", TZ), "");
});
