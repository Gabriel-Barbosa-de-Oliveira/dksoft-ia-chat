import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutBars, layoutLines, layoutPie, niceTicks, scaleLinear, thinLabels, type Box } from "./chart-layout.ts";
import type { ChartSpec } from "./chart-spec.ts";

const U = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const spec = (over: Partial<ChartSpec> = {}): ChartSpec => ({
  id: U, type: "bar", title: "t", valueKind: "integer", categories: ["a", "b", "c"],
  series: [{ name: "s", values: [10, 0, 5] }], summary: "r", resultId: U, partial: false, ...over,
});
const box: Box = { width: 400, height: 200, top: 10, right: 10, bottom: 30, left: 40 };

test("niceTicks 0–12300 usa passo 5.000 e cobre o máximo", () => {
  const t = niceTicks(0, 12300, 5);
  assert.deepEqual(t.ticks, [0, 5000, 10000, 15000]);
  assert.equal(t.min, 0);
  assert.equal(t.max, 15000);
  assert.deepEqual(niceTicks(0, 10, 5).ticks, [0, 2, 4, 6, 8, 10]);
});

test("niceTicks com intervalo vazio, zero e negativos", () => {
  assert.deepEqual(niceTicks(0, 0).ticks, [0, 1]);
  assert.ok(niceTicks(5, 5).ticks.includes(0) && niceTicks(5, 5).max >= 5);
  const neg = niceTicks(-30, 70, 5);
  assert.ok(neg.min <= -30 && neg.max >= 70 && neg.ticks.includes(0));
  assert.deepEqual(niceTicks(0, 1, 5).ticks.at(-1), 1);
});

test("scaleLinear interpola e tolera domínio degenerado", () => {
  const s = scaleLinear([0, 10], [100, 0]);
  assert.equal(s(0), 100);
  assert.equal(s(5), 50);
  assert.equal(scaleLinear([3, 3], [0, 10])(3), 5);
});

test("barras verticais: altura proporcional, valor 0 vira barra de altura 0, base na linha zero", () => {
  const out = layoutBars(spec(), box);
  const [a, b, c] = out.bars;
  assert.equal(b!.height, 0);
  assert.ok(a!.height > c!.height && c!.height > 0);
  assert.equal(a!.y + a!.height, out.zero);
  assert.equal(out.labels.length, 3);
  assert.ok(out.bars.every((r) => r.x >= box.left && r.x + r.width <= box.width - box.right + 0.01));
});

test("barras iguais têm a mesma altura; séries ficam lado a lado na categoria", () => {
  const out = layoutBars(spec({ series: [{ name: "x", values: [4, 4, 4] }, { name: "y", values: [4, 4, 4] }] }), box);
  assert.equal(new Set(out.bars.map((r) => r.height)).size, 1);
  const first = out.bars.filter((r) => r.category === 0);
  assert.ok(first[1]!.x >= first[0]!.x + first[0]!.width - 0.01);
});

test("barras horizontais trocam os eixos", () => {
  const out = layoutBars(spec(), box, "horizontal");
  assert.equal(out.orientation, "horizontal");
  assert.ok(out.bars[0]!.width > out.bars[2]!.width);
  assert.equal(out.bars[1]!.width, 0);
});

test("barras com valores negativos ficam abaixo da linha zero", () => {
  const out = layoutBars(spec({ series: [{ name: "s", values: [10, -5, 0] }] }), box);
  const neg = out.bars[1]!;
  assert.ok(neg.y >= out.zero - 0.01 && neg.height > 0);
});

test("linha com 1 ponto não quebra e centraliza", () => {
  const out = layoutLines(spec({ categories: ["a"], series: [{ name: "s", values: [7] }] }), box);
  assert.equal(out.lines[0]!.points.length, 1);
  assert.match(out.lines[0]!.d, /^M[\d.]+ [\d.]+$/);
  assert.equal(out.lines[0]!.points[0]!.x, 215);
});

test("linha: pontos em ordem de categoria, caminho com M e L, y menor para valor maior", () => {
  const out = layoutLines(spec(), box);
  const pts = out.lines[0]!.points;
  assert.deepEqual(pts.map((p) => p.category), [0, 1, 2]);
  assert.ok(pts[0]!.y < pts[1]!.y);
  assert.match(out.lines[0]!.d, /^M.* L.* L/);
  assert.equal(pts[0]!.x, box.left);
  assert.equal(pts[2]!.x, box.width - box.right);
});

test("pizza soma 360° e termina exatamente em 360", () => {
  const out = layoutPie(spec({ type: "pie", series: [{ name: "s", values: [1, 1, 1] }] }), box);
  assert.equal(out.slices.at(-1)!.endAngle, 360);
  assert.equal(out.slices[0]!.startAngle, 0);
  assert.ok(Math.abs(out.slices.reduce((a, s) => a + (s.endAngle - s.startAngle), 0) - 360) < 0.05);
  assert.ok(out.slices.every((s) => s.d.startsWith("M")));
});

test("pizza: fatia única vira círculo; valor zero não gera caminho; total zero não quebra", () => {
  const one = layoutPie(spec({ type: "pie", categories: ["a"], series: [{ name: "s", values: [9] }] }), box);
  assert.match(one.slices[0]!.d, /A.*A/);
  const zero = layoutPie(spec({ type: "pie", series: [{ name: "s", values: [5, 0, 5] }] }), box);
  assert.equal(zero.slices[1]!.d, "");
  const none = layoutPie(spec({ type: "pie", series: [{ name: "s", values: [0, 0, 0] }] }), box);
  assert.ok(none.slices.every((s) => s.d === "" && s.share === 0));
});

test("thinLabels mantém primeiro e último e evita sobreposição", () => {
  const labels = Array.from({ length: 24 }, (_, i) => `Sem ${i + 1}`);
  const show = thinLabels(labels, 300, 8);
  assert.equal(show[0], true);
  assert.equal(show.at(-1), true);
  assert.ok(show.filter(Boolean).length < 24);
  const idx = show.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const slot = 300 / 23;
  for (let i = 1; i < idx.length; i++) assert.ok((idx[i]! - idx[i - 1]!) * slot >= 5 * 7, "espaço mínimo");
});

test("thinLabels: poucos rótulos aparecem todos; lista vazia e um só rótulo", () => {
  assert.deepEqual(thinLabels(["a", "b", "c"], 300, 8), [true, true, true]);
  assert.deepEqual(thinLabels([], 300, 8), []);
  assert.deepEqual(thinLabels(["único"], 300, 8), [true]);
});
