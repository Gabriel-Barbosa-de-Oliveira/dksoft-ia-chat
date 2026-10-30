import { test } from "node:test";
import assert from "node:assert/strict";
import { createTokenBuffer, joinTokens } from "./join-tokens.ts";

test("junta na ordem", () => assert.equal(joinTokens(["a", "b", "c"]), "abc"));

test("drain devolve e esvazia", () => {
  const b = createTokenBuffer();
  b.push("O ");
  b.push("aluno");
  assert.equal(b.size, 2);
  assert.equal(b.drain(), "O aluno");
  assert.equal(b.size, 0);
  assert.equal(b.drain(), "");
});
