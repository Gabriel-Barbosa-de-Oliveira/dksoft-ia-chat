import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusNotice, type NoticeVariant } from "./StatusNotice.tsx";

const cases: Array<[NoticeVariant, string, RegExp]> = [
  ["error", "Erro", /role="alert"/],
  ["warning", "Aviso", /^(?!.*role=)/s],
  ["interrupted", "Interrompida", /^(?!.*role=)/s],
];

test("cada variante tem ícone, rótulo e texto", () => {
  for (const [variant, label, role] of cases) {
    const html = renderToStaticMarkup(
      <StatusNotice variant={variant} title="Título" actions={<button>Ação</button>}>
        Mensagem
      </StatusNotice>,
    );
    assert.match(html, /<svg[^>]*aria-hidden="true"/);
    assert.ok(html.includes(`<span>${label}</span>`), variant);
    assert.match(html, /Título/);
    assert.match(html, /Mensagem/);
    assert.match(html, /<button>Ação<\/button>/);
    assert.match(html, role, variant);
    assert.ok(html.includes(variant), `${variant}: classe da variante`);
  }
});

test("o módulo CSS não tem cor, px nem fonte literais e distingue as variantes sem depender de cor", () => {
  const css = readFileSync(new URL("./StatusNotice.module.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|\d+px\b/i);
  assert.match(css, /\.warning[^}]*dashed/s);
  assert.match(css, /\.interrupted[^}]*dotted/s);
});
