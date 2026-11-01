import assert from "node:assert/strict"
import { test } from "node:test"
import { sample } from "./testing/sample-chart.ts"
import { renderChartPng } from "./chart-png.ts"

const dims = (png: Uint8Array) => ({ w: new DataView(png.buffer, png.byteOffset).getUint32(16), h: new DataView(png.buffer, png.byteOffset).getUint32(20) })

test("bar, line and pie produce a PNG of the expected size", () => {
    for (const type of ["bar", "line", "pie"] as const) {
        const png = renderChartPng(sample({ type }))
        assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], type)
        assert.deepEqual(dims(png), { w: 1000, h: 560 }, type)
    }
})
test("text is really drawn with the bundled fonts: a different title changes the image", () => {
    const a = renderChartPng(sample({ title: "Recebimentos por semana" }))
    const b = renderChartPng(sample({ title: "" + "Ç".repeat(2) + " título" }))
    assert.notDeepEqual(Buffer.from(a), Buffer.from(b))
    const blank = renderChartPng(sample({ title: "x", categories: ["a", "b", "c"] }))
    assert.ok(blank.byteLength > 5000)
})
