import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldFollow } from "./scroll-follow.ts";

test("no fim", () => assert.equal(shouldFollow({ scrollTop: 600, clientHeight: 400, scrollHeight: 1000 }), true));
test("a 48 px do fim", () => assert.equal(shouldFollow({ scrollTop: 552, clientHeight: 400, scrollHeight: 1000 }), true));
test("a 49 px do fim", () => assert.equal(shouldFollow({ scrollTop: 551, clientHeight: 400, scrollHeight: 1000 }), false));
test("conteúdo menor que a janela", () =>
  assert.equal(shouldFollow({ scrollTop: 0, clientHeight: 400, scrollHeight: 200 }), true));
