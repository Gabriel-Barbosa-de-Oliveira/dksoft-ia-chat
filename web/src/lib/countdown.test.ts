import { test } from "node:test";
import assert from "node:assert/strict";
import { deadlineFrom, remainingSeconds, shouldAnnounce } from "./countdown.ts";

test("remainingSeconds arredonda para cima e tem piso 0", () => {
  const deadline = deadlineFrom(1000, 30);
  assert.equal(remainingSeconds(1000, deadline), 30);
  assert.equal(remainingSeconds(1001, deadline), 30);
  assert.equal(remainingSeconds(1000 + 29_001, deadline), 1);
  assert.equal(remainingSeconds(deadline, deadline), 0);
  assert.equal(remainingSeconds(deadline + 5000, deadline), 0);
});

test("shouldAnnounce a cada 15 s e ao zerar", () => {
  assert.equal(shouldAnnounce(31, 30), true);
  assert.equal(shouldAnnounce(30, 29), false);
  assert.equal(shouldAnnounce(16, 15), true);
  assert.equal(shouldAnnounce(1, 0), true);
  assert.equal(shouldAnnounce(0, 0), false);
});
