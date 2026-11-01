import { test } from "node:test";
import assert from "node:assert/strict";
import { markerPath, seriesStyle, sliceStyle, SERIES_COUNT } from "./chart-palette.ts";

test("as 6 séries diferem em cor, forma e padrão", () => {
  const styles = Array.from({ length: SERIES_COUNT }, (_, i) => seriesStyle(i));
  assert.equal(new Set(styles.map((s) => s.colorVar)).size, 6);
  assert.equal(new Set(styles.map((s) => s.marker)).size, 6);
  assert.equal(new Set(styles.map((s) => s.pattern)).size, 6);
  assert.equal(styles[0]!.pattern, "solid");
  assert.equal(styles[0]!.colorVar, "--chart-series-1");
});

test("índices fora da faixa dão a volta sem quebrar", () => {
  assert.deepEqual(seriesStyle(6), seriesStyle(0));
  assert.deepEqual(seriesStyle(-1), seriesStyle(5));
});

test("cada forma gera um caminho fechado distinto", () => {
  const paths = (["circle", "square", "triangle", "diamond", "cross", "star"] as const).map((s) => markerPath(s, 5));
  assert.equal(new Set(paths).size, 6);
  assert.ok(paths.every((p) => p.startsWith("M") && p.endsWith("Z")));
});

test("fatias 7 e 8 repetem a cor das séries 1 e 2 mas com padrão diferente", () => {
  for (const i of [6, 7]) {
    assert.equal(sliceStyle(i).colorVar, seriesStyle(i - 6).colorVar);
    assert.notEqual(sliceStyle(i).pattern, seriesStyle(i - 6).pattern);
  }
  assert.deepEqual(sliceStyle(2), seriesStyle(2));
  const all = Array.from({ length: 8 }, (_, i) => sliceStyle(i)).map((s) => `${s.colorVar}/${s.pattern}`);
  assert.equal(new Set(all).size, 8);
});
