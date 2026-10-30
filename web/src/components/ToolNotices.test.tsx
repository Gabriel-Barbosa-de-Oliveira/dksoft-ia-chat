import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ToolNotices } from "./ToolNotices.tsx";

test("lista vazia não renderiza nada", () => {
  assert.equal(renderToStaticMarkup(<ToolNotices tools={[]} />), "");
});

test("as três fases têm ícone e texto", () => {
  const html = renderToStaticMarkup(
    <ToolNotices
      tools={[
        { name: "a", label: "Buscando…", phase: "running" },
        { name: "b", label: "Listando", phase: "ok" },
        { name: "c", label: "Consultando", phase: "failed" },
      ]}
    />,
  );
  assert.equal((html.match(/<svg/g) ?? []).length, 3);
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 3);
  for (const text of ["Buscando…", "Listando", "Consultando", "em andamento", "concluída", "falhou"]) assert.ok(html.includes(text), text);
  assert.match(html, /class="[^"]*spin/);
  assert.match(html, /aria-label="Consultas"/);
});
