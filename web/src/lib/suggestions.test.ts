import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS } from "./suggestions.ts";

test("5 sugestões únicas e curtas, sem datas fixas", () => {
  assert.equal(SUGGESTIONS.length, 5);
  assert.equal(new Set(SUGGESTIONS).size, 5);
  for (const s of SUGGESTIONS) {
    assert.ok(s.length > 0 && s.length <= 4000);
    assert.doesNotMatch(s, /\b20\d{2}\b|\d{1,2}\/\d{1,2}/);
  }
});
