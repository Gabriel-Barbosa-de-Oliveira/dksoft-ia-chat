import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartView } from "./ChartView.tsx";
import type { ChartSpec } from "../lib/chart-spec.ts";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const base: ChartSpec = {
  id: U, type: "bar", title: "Recebido por semana", subtitle: "01/10/2026 a 31/10/2026", valueKind: "currency",
  categories: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
  series: [{ name: "Total recebido", values: [8200.5, 9100, 12300, 7050.25] }],
  summary: "Gráfico de barras com 4 semanas; maior valor R$ 12.300,00 na Sem 3.", resultId: U, partial: false,
};
const render = (chart: ChartSpec, narrow = false) => renderToStaticMarkup(<ChartView chart={chart} narrow={narrow} />);

test("barras: figure, legenda de série única ausente, svg com título e descrição", () => {
  const html = render(base);
  assert.match(html, /<figure/);
  assert.match(html, /<figcaption/);
  assert.match(html, /Recebido por semana/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-labelledby="[^"]+-title [^"]+-desc"/);
  assert.match(html, /<desc[^>]*>Gráfico de barras com 4 semanas/);
  assert.doesNotMatch(html, /aria-label="Legenda"/);
  assert.equal((html.match(/<rect[^>]*class="[^"]*bar/g) ?? []).length, 4);
});

test("a tabela de dados traz todos os valores, com legenda e cabeçalhos", () => {
  const html = render(base);
  assert.match(html, /<details/);
  assert.match(html, /Ver dados em tabela/);
  assert.match(html, /<caption[^>]*>Recebido por semana, 01\/10\/2026 a 31\/10\/2026/);
  for (const v of ["R$ 8.200,50", "R$ 9.100,00", "R$ 12.300,00", "R$ 7.050,25"]) assert.ok(html.includes(v), v);
  assert.match(html, /<th scope="col">Total recebido/);
  assert.match(html, /<th scope="row">Sem 3/);
  assert.match(html, /tabindex="0"/);
});

test("linhas com duas séries: legenda com os dois nomes e marcadores diferentes", () => {
  const html = render({ ...base, type: "line", series: [...base.series, { name: "Previsto", values: [8000, 9000, 11000, 7000] }] });
  assert.match(html, /aria-label="Legenda"/);
  assert.match(html, /Total recebido/);
  assert.match(html, /Previsto/);
  const markers = new Set([...html.matchAll(/<path d="(M[^"]+Z)" transform="translate/g)].map((m) => m[1]));
  assert.ok(markers.size >= 2, "formas diferentes por série");
});

test("pizza: fatias, legenda com participação e tabela com participação", () => {
  const html = render({ ...base, type: "pie", valueKind: "integer", series: [{ name: "Alunos", values: [30, 70, 0, 0] }] });
  assert.equal((html.match(/class="[^"]*slice/g) ?? []).length, 2, "fatia zerada não desenha");
  assert.match(html, /Sem 1 · 30%/);
  assert.match(html, /Sem 2 · 70%/);
  assert.match(html, /<th scope="col">Participação/);
  assert.match(html, /<pattern/);
});

test("séries distintas usam padrões de preenchimento diferentes", () => {
  const html = render({ ...base, series: [base.series[0]!, { name: "B", values: [1, 2, 3, 4] }, { name: "C", values: [1, 2, 3, 4] }] });
  assert.equal((html.match(/<pattern /g) ?? []).length >= 2, true);
  assert.match(html, /url\(#[^)]+-p1\)/);
});

test("partial mostra o aviso com ícone e texto", () => {
  const html = render({ ...base, partial: true });
  assert.match(html, /Resultado parcial/);
  assert.match(html, /<svg[^>]*aria-hidden="true"/);
  assert.doesNotMatch(render(base), /Resultado parcial/);
});

test("estreito com muitas categorias vira barras horizontais (viewBox 360 de largura)", () => {
  const categories = Array.from({ length: 8 }, (_, i) => `Mês ${i + 1}`);
  const html = render({ ...base, categories, series: [{ name: "s", values: categories.map((_, i) => i + 1) }] }, true);
  assert.match(html, /viewBox="0 0 360 /);
  const wide = render({ ...base, categories, series: [{ name: "s", values: categories.map((_, i) => i + 1) }] }, false);
  assert.match(wide, /viewBox="0 0 640 320"/);
});

test("um único ponto e valores zero desenham sem quebrar", () => {
  const html = render({ ...base, type: "line", categories: ["Único"], series: [{ name: "s", values: [0] }] });
  assert.match(html, /role="img"/);
  assert.match(render({ ...base, series: [{ name: "s", values: [0, 0, 0, 0] }] }), /role="img"/);
});

test("spec sem séries não lança (a borda de seção cobre falhas de desenho no navegador)", () => {
  const broken = { ...base, series: [] } as unknown as ChartSpec;
  assert.doesNotThrow(() => render(broken));
});

test("sem cor literal nem px no markup gerado", () => {
  const html = render(base);
  assert.doesNotMatch(html, /#[0-9a-f]{6}\b/i);
  assert.match(html, /var\(--chart-series-1\)/);
});
