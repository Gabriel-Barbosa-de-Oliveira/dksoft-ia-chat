import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChartSpecSchema } from "./chart-spec.ts";

const ID = "6f1c0d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f";
const valid = {
  id: ID,
  type: "bar",
  title: "Recebido por semana",
  valueKind: "currency",
  categories: ["Sem 1", "Sem 2"],
  series: [{ name: "Total", values: [10, 20.5] }],
  summary: "Gráfico de barras.",
  resultId: ID,
  partial: false,
};

describe("ChartSpecSchema (espelho)", () => {
  it("aceita um gráfico válido", () => assert.ok(ChartSpecSchema.safeParse(valid).success));
  it("recusa tipo desconhecido", () => assert.ok(!ChartSpecSchema.safeParse({ ...valid, type: "radar" }).success));
  it("recusa mais de 6 séries", () => {
    const series = Array.from({ length: 7 }, (_, i) => ({ name: `s${i}`, values: [1, 2] }));
    assert.ok(!ChartSpecSchema.safeParse({ ...valid, series }).success);
  });
  it("recusa valor não finito", () => {
    assert.ok(!ChartSpecSchema.safeParse({ ...valid, series: [{ name: "a", values: [Infinity, 1] }] }).success);
  });
});
