import { test } from "node:test";
import assert from "node:assert/strict";
import { isUuid, showCounter, validateMessage } from "./validation.ts";

test("vazio e só espaços", () => {
  assert.deepEqual(validateMessage(""), { ok: false, reason: "empty" });
  assert.deepEqual(validateMessage("  \n\t "), { ok: false, reason: "empty" });
});

test("limite de 4000 com trim", () => {
  assert.deepEqual(validateMessage(` ${"a".repeat(4000)} `), { ok: true, text: "a".repeat(4000) });
  assert.deepEqual(validateMessage("a".repeat(4001)), { ok: false, reason: "too_long", excess: 1 });
});

test("conta em unidades UTF-16, como o servidor", () => {
  const emojis = "😀".repeat(2001); // 4002 unidades, 2001 pontos de código
  assert.deepEqual(validateMessage(emojis), { ok: false, reason: "too_long", excess: 2 });
});

test("contador a partir de 3600", () => {
  assert.equal(showCounter(3599), false);
  assert.equal(showCounter(3600), true);
});

test("isUuid", () => {
  assert.ok(isUuid("22222222-2222-4222-8222-222222222222"));
  assert.ok(isUuid("AAAAAAAA-AAAA-1AAA-AAAA-AAAAAAAAAAAA"));
  assert.ok(isUuid("00000000-0000-0000-0000-000000000000"));
  assert.equal(isUuid("abc"), false);
  assert.equal(isUuid("22222222-2222-4222-8222-22222222222"), false);
});
