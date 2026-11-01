import { test } from "node:test";
import assert from "node:assert/strict";
import { fileExpiry, formatClock, formatSize, initialFileState, nextFileState, type FileCardState } from "./export-state.ts";
import { toUserError } from "./errors.ts";

const err = toUserError({ source: "network" });
const run = (s: FileCardState, ...events: Parameters<typeof nextFileState>[1][]) => events.reduce(nextFileState, s);

test("fluxo feliz: ready → downloading → downloaded → downloading (baixar de novo)", () => {
  assert.equal(run(initialFileState, { type: "START" }).kind, "downloading");
  assert.equal(run(initialFileState, { type: "START" }, { type: "OK" }).kind, "downloaded");
  assert.equal(run(initialFileState, { type: "START" }, { type: "OK" }, { type: "START" }).kind, "downloading");
});

test("falha leva a error e permite tentar de novo", () => {
  const s = run(initialFileState, { type: "START" }, { type: "FAIL", error: err });
  assert.equal(s.kind, "error");
  assert.equal(run(s, { type: "START" }).kind, "downloading");
});

test("404 antes do prazo → expirado por 'missing'", () => {
  assert.deepEqual(run(initialFileState, { type: "START" }, { type: "NOT_FOUND" }), { kind: "expired", reason: "missing" });
});

test("relógio vence cartão pronto, baixado ou com erro; não interrompe download em curso", () => {
  assert.deepEqual(run(initialFileState, { type: "TICK", expired: true }), { kind: "expired", reason: "clock" });
  assert.equal(run(initialFileState, { type: "TICK", expired: false }), initialFileState);
  const downloading = run(initialFileState, { type: "START" });
  assert.equal(run(downloading, { type: "TICK", expired: true }), downloading);
});

test("expirado só sai por REGENERATE; eventos soltos são ignorados", () => {
  const expired = run(initialFileState, { type: "TICK", expired: true });
  assert.equal(run(expired, { type: "START" }), expired);
  assert.equal(run(expired, { type: "OK" }), expired);
  assert.equal(run(expired, { type: "REGENERATE" }).kind, "regenerating");
  assert.equal(run(initialFileState, { type: "REGENERATE" }), initialFileState);
});

test("fileExpiry: contagem só nos últimos 300 s e expira no prazo", () => {
  const exp = "2026-10-31T22:00:00.000Z";
  const at = (iso: string) => Date.parse(iso);
  assert.deepEqual(fileExpiry(at("2026-10-31T21:30:00.000Z"), exp), { expired: false, secondsLeft: 1800, showCountdown: false });
  assert.deepEqual(fileExpiry(at("2026-10-31T21:55:00.000Z"), exp), { expired: false, secondsLeft: 300, showCountdown: true });
  assert.deepEqual(fileExpiry(at("2026-10-31T22:00:00.000Z"), exp), { expired: true, secondsLeft: 0, showCountdown: false });
  assert.equal(fileExpiry(0, "lixo").expired, true);
});

test("formatClock e formatSize", () => {
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatSize(512), "512 B");
  assert.equal(formatSize(48211), "47 KB");
  assert.equal(formatSize(2 * 1024 * 1024 + 300000), "2,3 MB");
});

test("regeneração: sucesso volta a ready, falha volta a expirado", () => {
  const regen = run(initialFileState, { type: "TICK", expired: true }, { type: "REGENERATE" });
  assert.equal(run(regen, { type: "READY" }).kind, "ready");
  assert.equal(run(regen, { type: "REGEN_FAIL" }).kind, "expired");
  assert.equal(run(initialFileState, { type: "READY" }), initialFileState);
});

import { canExport, resultLive } from "./export-state.ts";

test("resultLive: vivo até o prazo exato; sem resultado ou data ruim não é vivo", () => {
  const result = { expiresAt: "2026-10-31T22:00:00.000Z" };
  const at = (iso: string) => Date.parse(iso);
  assert.deepEqual(resultLive(result, at("2026-10-31T21:59:59.000Z")), { live: true, secondsLeft: 1 });
  assert.deepEqual(resultLive(result, at("2026-10-31T22:00:00.000Z")), { live: false, secondsLeft: 0 });
  assert.equal(resultLive(null, 0).live, false);
  assert.equal(resultLive({ expiresAt: "lixo" }, 0).live, false);
});

test("canExport: só em turno concluído com resultado vivo (histórico, erro e interrupção ficam de fora)", () => {
  const result = { expiresAt: "2026-10-31T22:00:00.000Z" };
  const now = Date.parse("2026-10-31T21:00:00.000Z");
  assert.equal(canExport({ status: "done", result }, now), true);
  assert.equal(canExport({ status: "done", result: null }, now), false, "histórico não tem resultado");
  assert.equal(canExport({ status: "error", result }, now), false);
  assert.equal(canExport({ status: "interrupted", result }, now), false);
  assert.equal(canExport({ status: "streaming", result }, now), false);
  assert.equal(canExport({ status: "done", result }, Date.parse("2026-10-31T22:00:00.000Z")), false);
});
