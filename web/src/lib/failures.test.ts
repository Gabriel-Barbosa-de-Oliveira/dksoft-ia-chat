import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiFailure, UnexpectedResponseError, toUserErrorFrom } from "./failures.ts";

test("ApiFailure vira a mensagem do kind", () => {
  assert.equal(toUserErrorFrom(new ApiFailure({ source: "network" })).kind, "network");
});

test("exceções desconhecidas viram unexpected_response sem texto cru", () => {
  for (const e of [new Error("segredo interno"), new UnexpectedResponseError("token"), "x", null]) {
    const user = toUserErrorFrom(e);
    assert.equal(user.kind, "unexpected_response");
    assert.doesNotMatch(user.message, /segredo/);
  }
});
