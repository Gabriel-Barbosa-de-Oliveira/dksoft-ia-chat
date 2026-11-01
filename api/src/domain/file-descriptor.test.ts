import assert from "node:assert/strict"
import { test } from "node:test"
import { FileDescriptorSchema, MIME_BY_FORMAT, downloadPathOf, toDescriptor, type StoredFile } from "./file-descriptor.ts"

const U = "11111111-1111-4111-8111-111111111111"
const V = "22222222-2222-4222-8222-222222222222"
const stored: StoredFile = {
    id: U, conversationId: V, resultId: U, name: "contas-20261031-213015.xlsx", format: "xlsx", mime: MIME_BY_FORMAT.xlsx, sizeBytes: 3,
    rowCount: 1, includesChart: false, containsFullPersonalData: false, createdAt: "2026-10-31T21:30:15.000Z", expiresAt: "2026-10-31T22:00:15.000Z", bytes: new Uint8Array([1, 2, 3]),
}
test("descriptor never carries bytes and validates", () => {
    const d = toDescriptor(stored)
    assert.equal("bytes" in d, false)
    assert.equal(FileDescriptorSchema.safeParse(d).success, true)
    assert.equal(d.downloadPath, `/conversations/${V}/exports/${U}`)
})
test("mime per format and download path", () => {
    assert.equal(MIME_BY_FORMAT.pdf, "application/pdf")
    assert.match(MIME_BY_FORMAT.docx, /wordprocessingml/)
    assert.equal(downloadPathOf("a", "b"), "/conversations/a/exports/b")
})
