import assert from "node:assert/strict"
import { test } from "node:test"
import { extractRows } from "./extract-rows.ts"

test("direct list of objects", () => {
    assert.deepEqual(extractRows('[{"a":1},{"a":2}]'), { rows: [{ a: 1 }, { a: 2 }], context: {} })
})
test("object with exactly one list keeps the rest as context", () => {
    assert.deepEqual(extractRows('{"tipo":"x","registros":[{"a":1}]}'), { rows: [{ a: 1 }], context: { tipo: "x" } })
})
test("object with two lists is not a result", () => {
    assert.equal(extractRows('{"a":[{"x":1}],"b":[{"y":1}]}'), undefined)
})
test("not json, list of non-objects and plain object are not results", () => {
    assert.equal(extractRows("texto"), undefined)
    assert.equal(extractRows("[1,2]"), undefined)
    assert.equal(extractRows('{"a":1}'), undefined)
})
test("empty list is a result with no rows", () => {
    assert.deepEqual(extractRows("[]"), { rows: [], context: {} })
})
