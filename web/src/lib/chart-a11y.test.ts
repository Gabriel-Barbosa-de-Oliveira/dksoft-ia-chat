import { test } from "node:test";
import assert from "node:assert/strict";
import { chartDescription, chartTableRows, tooltipText } from "./chart-a11y.ts";
import type { ChartSpec } from "./chart-spec.ts";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const bar: ChartSpec = {
  id: U, type: "bar", title: "Recebido por semana", subtitle: "01/10/2026 a 31/10/2026", valueKind: "currency",
  categories: ["Sem 1", "Sem 2"], series: [{ name: "Total", values: [8200.5, 9100] }, { name: "Previsto", values: [8000, 9500] }],
  summary: "Gráfico de barras com 2 semanas.", resultId: U, partial: false,
};
const pie: ChartSpec = { ...bar, type: "pie", series: [{ name: "Total", values: [30, 70] }], valueKind: "integer" };

test("tabela de barras: cabeçalho com séries e todos os valores formatados", () => {
  const t = chartTableRows(bar);
  assert.deepEqual(t.header, ["Categoria", "Total", "Previsto"]);
  assert.deepEqual(t.rows[0], ["Sem 1", "R$ 8.200,50", "R$ 8.000,00"]);
  assert.equal(t.rows.length, 2);
  assert.equal(t.caption, "Recebido por semana, 01/10/2026 a 31/10/2026");
});

test("tabela de pizza mostra a participação", () => {
  const t = chartTableRows(pie);
  assert.deepEqual(t.header, ["Categoria", "Total", "Participação"]);
  assert.deepEqual(t.rows, [["Sem 1", "30", "30%"], ["Sem 2", "70", "70%"]]);
});

test("rótulo do eixo x vira o cabeçalho da primeira coluna", () => {
  assert.equal(chartTableRows({ ...bar, xLabel: "Semana" }).header[0], "Semana");
});

test("dica: uma série omite o nome; várias incluem; pizza inclui a participação", () => {
  assert.equal(tooltipText({ ...bar, series: [bar.series[0]!] }, 0, 1), "Sem 2: R$ 9.100,00");
  assert.equal(tooltipText(bar, 1, 0), "Sem 1 · Previsto: R$ 8.000,00");
  assert.equal(tooltipText(pie, 0, 1), "Sem 2: 70 (70%)");
  assert.equal(tooltipText(bar, 5, 0), "");
});

test("descrição usa o resumo e cai num texto padrão se vier vazio", () => {
  assert.equal(chartDescription(bar), "Gráfico de barras com 2 semanas.");
  assert.match(chartDescription({ ...bar, summary: "  " }), /Gráfico de barras com 2 categorias e 2 séries\./);
});
