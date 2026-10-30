import { test } from "node:test";
import assert from "node:assert/strict";
import { compose, contrastRatio, parseColor } from "./contrast.ts";

const c = parseColor;
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= 0.01, `${actual} ≠ ${expected}`);

test("referências do research.md (item 9)", () => {
  const bg = c("#f3f2f2");
  near(contrastRatio(c("#201e1d"), bg), 14.86);
  near(contrastRatio(c("#ec3013"), bg), 3.76);
  near(contrastRatio(c("#ae1800"), bg), 6.41);
  near(contrastRatio(compose(c("#201e1d"), 0.4, bg), bg), 2.41);
  near(contrastRatio(compose(c("#201e1d"), 0.55, bg), bg), 3.65);
});

test("parseColor aceita #rgb e rejeita o resto", () => {
  assert.deepEqual(c("#fff"), { r: 255, g: 255, b: 255 });
  assert.throws(() => c("rgb(0,0,0)"));
});

test("preto sobre branco é 21", () => near(contrastRatio(c("#000"), c("#fff")), 21));
