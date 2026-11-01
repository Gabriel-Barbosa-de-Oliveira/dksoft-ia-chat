import assert from "node:assert/strict"
import { test } from "node:test"
import { toDescriptor, type StoredFile } from "../domain/file-descriptor.ts"
import { createMemoryFileStore } from "./memory-file-store.ts"

const file = (id: string, conversationId: string, expiresAt: number, size = 10): StoredFile => ({
    id, conversationId, resultId: "r", name: `${id}.pdf`, format: "pdf", mime: "application/pdf", sizeBytes: size, rowCount: 1,
    includesChart: false, containsFullPersonalData: false, createdAt: "x", expiresAt: new Date(expiresAt).toISOString(), bytes: new Uint8Array(size),
})

test("get requires the owning conversation and a live file", () => {
    const clock = { t: 1000 }
    const s = createMemoryFileStore({ maxBytes: 1e6, now: () => clock.t })
    s.save(file("f1", "c1", 5000))
    assert.ok(s.get("c1", "f1"))
    assert.equal(s.get("c2", "f1"), undefined)
    clock.t = 5000
    assert.equal(s.get("c1", "f1"), undefined)
})
test("byte cap drops the oldest and per-conversation cap holds", () => {
    const s = createMemoryFileStore({ maxBytes: 25, now: () => 0 })
    s.save(file("a", "c1", 9e9)); s.save(file("b", "c1", 9e9)); s.save(file("c", "c1", 9e9))
    assert.equal(s.get("c1", "a"), undefined)
    assert.ok(s.get("c1", "c"))
    const t = createMemoryFileStore({ maxBytes: 1e9, maxPerConversation: 2, now: () => 0 })
    for (const id of ["a", "b", "c"]) t.save(file(id, "c1", 9e9))
    assert.deepEqual(t.names("c1"), ["b.pdf", "c.pdf"])
})
test("public descriptor does not expose bytes", () => {
    assert.equal("bytes" in toDescriptor(file("a", "c1", 9e9)), false)
})
