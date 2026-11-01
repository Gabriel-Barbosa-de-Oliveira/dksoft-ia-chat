import assert from "node:assert/strict"
import { test } from "node:test"
import { ExportBusyError, ExportTimeoutError, ExportTooLargeError, NothingToExportError, ResultNotFoundError, ChartNotFoundError } from "../../domain/errors.ts"
import { MIME_BY_FORMAT, toDescriptor, type StoredFile } from "../../domain/file-descriptor.ts"
import type { ExportService } from "../../services/export.service.ts"
import { createMemoryFileStore } from "../../store/memory-file-store.ts"
import { openDatabase } from "../../store/db.ts"
import { createSqliteConversationStore } from "../../store/sqlite-conversation-store.ts"
import { createApp } from "../app.ts"
import { ACCESS_KEY, auth } from "../test-app.ts"

const U = "11111111-1111-4111-8111-111111111111"
const F = "22222222-2222-4222-8222-222222222222"
const NOW = Date.parse("2026-10-31T21:00:00.000Z")

async function setup(exportImpl?: ExportService["export"], rateLimit = 1000) {
    const db = openDatabase(":memory:")
    const conversations = createSqliteConversationStore(db)
    const conversationId = conversations.create()
    const files = createMemoryFileStore({ maxBytes: 1e9, now: () => NOW })
    const stored: StoredFile = {
        id: F, conversationId, resultId: U, name: "contas-recebidas-20261031-183015.xlsx", format: "xlsx", mime: MIME_BY_FORMAT.xlsx, sizeBytes: 4, rowCount: 1,
        includesChart: false, containsFullPersonalData: false, createdAt: new Date(NOW).toISOString(), expiresAt: new Date(NOW + 600_000).toISOString(), bytes: new Uint8Array([9, 8, 7, 6]),
    }
    files.save(stored)
    const calls: Parameters<ExportService["export"]>[0][] = []
    const exports = { export: exportImpl ?? (async (r) => { calls.push(r); return toDescriptor(stored) }) } as ExportService
    const app = await createApp({ logger: false, conversations, accessKey: ACCESS_KEY, corsOrigins: [], artifacts: { exports, files, rateLimitPerMin: rateLimit } })
    return { app, conversationId, calls, conversations }
}
const post = (app: Awaited<ReturnType<typeof setup>>["app"], body: unknown, headers: Record<string, string> = auth) => app.inject({ method: "POST", url: "/exports", headers, payload: body as never })

test("download: attachment with security headers and the exact bytes", async () => {
    const t = await setup()
    const res = await t.app.inject({ method: "GET", url: `/conversations/${t.conversationId}/exports/${F}`, headers: auth })
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers["content-type"], MIME_BY_FORMAT.xlsx)
    assert.match(String(res.headers["content-disposition"]), /^attachment; filename="contas-recebidas-20261031-183015\.xlsx"; filename\*=UTF-8''contas-recebidas-20261031-183015\.xlsx$/)
    assert.equal(res.headers["content-length"], "4")
    assert.equal(res.headers["cache-control"], "no-store")
    assert.equal(res.headers["x-content-type-options"], "nosniff")
    assert.deepEqual([...res.rawPayload], [9, 8, 7, 6])
})
test("download without key -> 401; wrong conversation, unknown and invalid ids -> identical 404", async () => {
    const t = await setup()
    assert.equal((await t.app.inject({ method: "GET", url: `/conversations/${t.conversationId}/exports/${F}` })).statusCode, 401)
    const other = "33333333-3333-4333-8333-333333333333"
    const bodies = []
    for (const url of [`/conversations/${other}/exports/${F}`, `/conversations/${t.conversationId}/exports/${other}`, `/conversations/x/exports/y`]) {
        const res = await t.app.inject({ method: "GET", url, headers: auth })
        assert.equal(res.statusCode, 404, url)
        const { requestId: _r, ...rest } = res.json()
        bodies.push(rest)
    }
    assert.deepEqual(bodies, [{ error: "file_not_found" }, { error: "file_not_found" }, { error: "file_not_found" }])
})
test("download of an expired file -> 404", async () => {
    const db = openDatabase(":memory:")
    const conversations = createSqliteConversationStore(db)
    const id = conversations.create()
    let clock = NOW
    const files = createMemoryFileStore({ maxBytes: 1e9, now: () => clock })
    files.save({ id: F, conversationId: id, resultId: U, name: "a.pdf", format: "pdf", mime: "application/pdf", sizeBytes: 1, rowCount: 1, includesChart: false, containsFullPersonalData: false, createdAt: "x", expiresAt: new Date(NOW + 1000).toISOString(), bytes: new Uint8Array(1) })
    const app = await createApp({ logger: false, conversations, accessKey: ACCESS_KEY, corsOrigins: [], artifacts: { exports: {} as ExportService, files, rateLimitPerMin: 10 } })
    assert.equal((await app.inject({ method: "GET", url: `/conversations/${id}/exports/${F}`, headers: auth })).statusCode, 200)
    clock = NOW + 2000
    assert.equal((await app.inject({ method: "GET", url: `/conversations/${id}/exports/${F}`, headers: auth })).statusCode, 404)
})
test("POST /exports -> 201 with the descriptor, always masked, origin button", async () => {
    const t = await setup()
    const res = await post(t.app, { conversationId: t.conversationId, resultId: U, format: "xlsx", chartId: F })
    assert.equal(res.statusCode, 201)
    assert.equal(res.json().file.id, F)
    assert.equal(res.json().requestId, res.headers["x-request-id"])
    assert.equal("bytes" in res.json().file, false)
    assert.deepEqual([t.calls[0]!.maskPersonalData, t.calls[0]!.origin, t.calls[0]!.chartId], [true, "button", F])
})
test("POST /exports: invalid bodies -> 400 (including attempts to ask for full personal data), no key -> 401, unknown conversation -> 404", async () => {
    const t = await setup()
    const ok = { conversationId: t.conversationId, resultId: U, format: "pdf" }
    for (const bad of [{}, { ...ok, format: "csv" }, { ...ok, resultId: "x" }, { ...ok, maskPersonalData: false }, { ...ok, dadosPessoaisCompletos: true }]) assert.equal((await post(t.app, bad)).statusCode, 400, JSON.stringify(bad))
    assert.equal((await post(t.app, ok, {})).statusCode, 401)
    const res = await post(t.app, { ...ok, conversationId: U })
    assert.equal(res.statusCode, 404)
    assert.equal(res.json().error, "conversation_not_found")
    assert.equal(t.calls.length, 0)
})
test("POST /exports: domain errors map to the documented statuses", async () => {
    const cases: [Error, number, string][] = [
        [new ResultNotFoundError(), 404, "result_not_found"], [new ChartNotFoundError(), 404, "chart_not_found"], [new ExportTooLargeError(9000, 5000), 413, "export_too_large"],
        [new NothingToExportError(), 422, "nothing_to_export"], [new ExportBusyError(7), 429, "export_busy"], [new ExportTimeoutError(), 504, "export_timeout"], [new Error("boom: 12345678909"), 500, "internal_error"],
    ]
    for (const [err, status, code] of cases) {
        const t = await setup(async () => { throw err })
        const res = await post(t.app, { conversationId: t.conversationId, resultId: U, format: "pdf" })
        assert.equal(res.statusCode, status, code)
        assert.equal(res.json().error, code)
        assert.ok(!res.body.includes("boom") && !res.body.includes("12345678909"), "no internal detail")
        if (code === "export_too_large") assert.deepEqual([res.json().rows, res.json().maxRows], [9000, 5000])
        if (code === "export_busy") assert.equal(res.json().retryAfterSeconds, 7)
    }
})
test("POST /exports is rate limited per IP", async () => {
    const t = await setup(undefined, 2)
    const body = { conversationId: t.conversationId, resultId: U, format: "pdf" }
    assert.equal((await post(t.app, body)).statusCode, 201)
    assert.equal((await post(t.app, body)).statusCode, 201)
    const third = await post(t.app, body)
    assert.equal(third.statusCode, 429)
    assert.equal(third.json().error, "rate_limited")
    assert.ok(third.json().retryAfterSeconds >= 1)
})
test("without the artifacts option the routes do not exist", async () => {
    const db = openDatabase(":memory:")
    const app = await createApp({ logger: false, conversations: createSqliteConversationStore(db), accessKey: ACCESS_KEY, corsOrigins: [] })
    assert.equal((await post(app, {})).statusCode, 404)
    assert.equal((await app.inject({ method: "GET", url: `/conversations/${U}/exports/${F}`, headers: auth })).statusCode, 404)
})

import { buildLoggerOptions } from "../../obs/logger.ts"
import Fastify from "fastify"

test("request logs never carry the file id, the file name or the key (SC-007)", async () => {
    const lines: string[] = []
    const t = await setup()
    const app = Fastify({ logger: buildLoggerOptions({ write: (c: string) => void lines.push(c) }) })
    app.get("/conversations/:c/exports/:f", async () => "ok")
    await app.inject({ method: "GET", url: `/conversations/${t.conversationId}/exports/${F}`, headers: auth })
    await app.close()
    const logs = lines.join("")
    assert.ok(logs.length > 0)
    assert.ok(!logs.includes(F), "file id in logs")
    assert.ok(!logs.includes(ACCESS_KEY), "key in logs")
    assert.ok(logs.includes(":fileId"))
})
