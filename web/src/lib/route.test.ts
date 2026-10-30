import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationPath, parseRoute } from "./route.ts";

test("rotas conhecidas", () => {
  assert.deepEqual(parseRoute("/"), { kind: "new" });
  assert.deepEqual(parseRoute(""), { kind: "new" });
  assert.deepEqual(parseRoute("/c/abc"), { kind: "conversation", id: "abc" });
  assert.deepEqual(parseRoute("/c/abc/"), { kind: "conversation", id: "abc" });
});

test("o resto é desconhecido", () => {
  for (const p of ["/x", "/c", "/c/", "/c/a/b", "/conversas/1"]) assert.deepEqual(parseRoute(p), { kind: "unknown" }, p);
});

test("ida e volta com caracteres especiais", () => {
  assert.equal(conversationPath("a b"), "/c/a%20b");
  assert.deepEqual(parseRoute(conversationPath("a b")), { kind: "conversation", id: "a b" });
  assert.deepEqual(parseRoute("/c/%E0%A4%A"), { kind: "conversation", id: "%E0%A4%A" });
});
