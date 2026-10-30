import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Skeleton } from "./Skeleton.tsx";

test("N blocos escondidos do leitor de tela e um único rótulo", () => {
  const html = renderToStaticMarkup(<Skeleton lines={5} />);
  assert.equal((html.match(/class="bar"/g) ?? []).length, 5);
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 5);
  assert.equal((html.match(/Carregando…/g) ?? []).length, 1);
  assert.match(html, /role="status"/);
});

test("rótulo personalizado", () => {
  assert.match(renderToStaticMarkup(<Skeleton label="Carregando conversas…" />), /Carregando conversas…/);
});
