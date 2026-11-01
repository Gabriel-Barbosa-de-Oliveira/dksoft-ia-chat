import assert from "node:assert/strict"
import { test } from "node:test"
import { ChartRequestSchema } from "./chart-request.ts"

const ok = { type: "bar", title: "t", groupBy: "banco", measure: { kind: "count" } }
test("valid forms", () => {
    assert.ok(ChartRequestSchema.safeParse(ok).success)
    assert.ok(ChartRequestSchema.safeParse({ ...ok, type: "line", groupBy: "data_pagamento", granularity: "week", measure: { kind: "sum", field: "valor_pago" }, splitBy: "banco", sort: "x", limit: 10 }).success)
    assert.ok(ChartRequestSchema.safeParse({ ...ok, type: "pie", resultId: "11111111-1111-4111-8111-111111111111" }).success)
})
test("invalid forms", () => {
    for (const bad of [
        { ...ok, type: "pie", splitBy: "conta" }, { ...ok, title: "" }, { ...ok, title: "x".repeat(121) }, { ...ok, limit: 25 }, { ...ok, limit: 0 },
        { ...ok, measure: { kind: "sum" } }, { ...ok, granularity: "year" }, { ...ok, type: "donut" },
    ]) assert.equal(ChartRequestSchema.safeParse(bad).success, false, JSON.stringify(bad))
})
