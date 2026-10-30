import { test } from "node:test";
import assert from "node:assert/strict";
import { nextPreference, parseThemePreference, resolveTheme } from "./theme.ts";

test("valor inválido vira system", () => {
  for (const raw of [null, undefined, "", "azul", 3, {}]) assert.equal(parseThemePreference(raw), "system");
  for (const v of ["system", "light", "dark"]) assert.equal(parseThemePreference(v), v);
});

test("resolveTheme", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("nextPreference percorre o ciclo", () => {
  assert.equal(nextPreference("system"), "light");
  assert.equal(nextPreference("light"), "dark");
  assert.equal(nextPreference("dark"), "system");
});
