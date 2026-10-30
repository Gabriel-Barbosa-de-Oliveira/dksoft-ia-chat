import assert from "node:assert/strict"
import { test } from "node:test"
import { validatePaidBillsPeriod } from "../src/domain/paidBills.ts"
import { validateReceivablePeriod } from "../src/domain/receivableAccount.ts"

for (const [name, fn] of [["paidBills", validatePaidBillsPeriod], ["receivable", validateReceivablePeriod]] as const) {
    test(`${name}: 30 days inclusive`, () => {
        assert.equal(fn("2026-01-01", "2026-01-30"), undefined)
        assert.equal(fn("2026-01-01", "2026-01-01"), undefined)
        assert.match(fn("2026-01-01", "2026-01-31")!, /counting both dates/)
    })
    test(`${name}: leap year, inverted and invalid`, () => {
        assert.equal(fn("2028-02-01", "2028-03-01"), undefined)
        assert.match(fn("2026-02-01", "2026-03-03")!, /at most 30/)
        assert.match(fn("2026-02-10", "2026-02-01")!, /on or after/)
        assert.match(fn("abc", "2026-02-01")!, /Invalid period/)
    })
}
