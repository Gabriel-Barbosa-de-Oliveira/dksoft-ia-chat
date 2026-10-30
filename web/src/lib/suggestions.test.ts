import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS } from "./suggestions.ts";

test("4 sugestões únicas e curtas, sem datas fixas", () => {
  assert.equal(SUGGESTIONS.length, 4);
  assert.equal(new Set(SUGGESTIONS).size, 4);
  for (const s of SUGGESTIONS) {
    assert.ok(s.length > 0 && s.length <= 4000);
    assert.doesNotMatch(s, /\b20\d{2}\b|\d{1,2}\/\d{1,2}/);
  }
});
