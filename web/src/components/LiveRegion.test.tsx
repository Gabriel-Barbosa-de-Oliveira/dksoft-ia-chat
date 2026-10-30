import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AnnouncerProvider, LiveRegion } from "./LiveRegion.tsx";

test("região educada e região de alerta", () => {
  const html = renderToStaticMarkup(<LiveRegion polite="Resposta concluída." alert="" />);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /sr-only/);
  assert.match(html, />Resposta concluída\.</);
});

test("o provedor renderiza os filhos e as duas regiões vazias", () => {
  const html = renderToStaticMarkup(
    <AnnouncerProvider>
      <p>conteúdo</p>
    </AnnouncerProvider>,
  );
  assert.match(html, /<p>conteúdo<\/p>/);
  assert.equal((html.match(/sr-only/g) ?? []).length, 2);
});
