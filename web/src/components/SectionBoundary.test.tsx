import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { SectionBoundary } from "./SectionBoundary.tsx";

test("sem falha, renderiza os filhos", () => {
  assert.match(renderToStaticMarkup(<SectionBoundary><p>ok</p></SectionBoundary>), /<p>ok<\/p>/);
});

test("depois de uma falha, mostra o painel de erro com Tentar novamente e nada do filho", () => {
  const boundary = new SectionBoundary({ children: <p>filho</p> });
  boundary.state = SectionBoundary.getDerivedStateFromError();
  const html = renderToStaticMarkup(<>{boundary.render()}</>);
  assert.match(html, /Resposta inesperada/);
  assert.match(html, /Tentar novamente/);
  assert.doesNotMatch(html, /filho/);
});

test("uma seção em falha não afeta a irmã", () => {
  const broken = new SectionBoundary({ children: <p>quebrado</p> });
  broken.state = { failed: true };
  const healthy = new SectionBoundary({ children: <p>saudável</p> });
  const html = renderToStaticMarkup(<>{broken.render()}{healthy.render()}</>);
  assert.match(html, /saudável/);
  assert.doesNotMatch(html, /quebrado/);
});
