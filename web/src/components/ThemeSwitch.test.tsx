import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeSwitch } from "./ThemeSwitch.tsx";

test("grupo Aparência com duas opções nativas", () => {
  const html = renderToStaticMarkup(<ThemeSwitch />);
  assert.match(html, /<legend[^>]*>Aparência<\/legend>/);
  assert.equal((html.match(/type="radio"/g) ?? []).length, 2);
  assert.match(html, />Claro</);
  assert.match(html, />Escuro</);
});
