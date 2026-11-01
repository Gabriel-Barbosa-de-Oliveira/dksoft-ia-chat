import assert from "node:assert/strict"
import { test } from "node:test"
import { createAgent, tool } from "langchain"
import { AIMessage } from "@langchain/core/messages"
import { z } from "zod"
import { ScriptedModel } from "./testing/scripted-model.ts"
import { createLimiter } from "../services/limiter.ts"
import { modelTracker, resilienceMiddleware, shapeResultsMiddleware, toolRetryAndLimiter, type RunTracker } from "./middleware.ts"

const big = tool(async () => JSON.stringify(Array.from({ length: 400 }, (_, i) => ({ id: i, valor_pago: 1.5 }))), {
    name: "dksoft_list_paid_bills", description: "x", schema: z.object({}),
})

test("big tool result is shaped before the model sees it and flags partial", async () => {
    const model = new ScriptedModel({
        script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_paid_bills", args: {}, id: "1" }] }), new AIMessage("ok")],
    })
    const tracker: RunTracker = { partial: false, toolCalls: 0, model: null }
    const agent = createAgent({ model, tools: [big], middleware: [shapeResultsMiddleware({ maxRows: 40, maxChars: 24000 }, tracker)] })
    const out = await agent.invoke({ messages: [{ role: "user", content: "oi" }] })
    const toolMsg = out.messages.find((m: { type?: string }) => m.type === "tool") as { content: string }
    const parsed = JSON.parse(toolMsg.content)
    assert.equal(parsed.total, 400)
    assert.equal(parsed.somas.valor_pago, 600)
    assert.equal(parsed.registros.length, 40)
    assert.equal(tracker.partial, true)
    assert.equal(tracker.toolCalls, 1)
})

const msgs = [{ role: "user", content: "oi" }]
const transient = Object.assign(new Error("503 provider down"), { status: 503 })
const lastText = (out: { messages: { content: unknown }[] }) => String(out.messages.at(-1)!.content)

test("primary always 503 → fallback answers (primary 2 calls, fallback 1)", async () => {
    const primary = new ScriptedModel({ name: "main", script: [], failTimes: 99, failWith: transient })
    const fallback = new ScriptedModel({ name: "reserva", script: [new AIMessage("da reserva")] })
    const tracker: RunTracker = { partial: false, toolCalls: 0, model: "main" }
    const agent = createAgent({ model: primary, tools: [], middleware: [...resilienceMiddleware({ fallbackModel: fallback, modelRetryDelayMs: 1 }), modelTracker(tracker)] } as never)
    const out = await agent.invoke({ messages: msgs })
    assert.equal(lastText(out), "da reserva")
    assert.equal(primary.calls, 2)
    assert.equal(fallback.calls, 1)
    assert.equal(tracker.model, "reserva")
})

test("permanent error is not retried on the primary", async () => {
    const primary = new ScriptedModel({ name: "main", script: [], failTimes: 99, failWith: Object.assign(new Error("401"), { status: 401 }) })
    const fallback = new ScriptedModel({ name: "reserva", script: [new AIMessage("ok")] })
    const agent = createAgent({ model: primary, tools: [], middleware: resilienceMiddleware({ fallbackModel: fallback, modelRetryDelayMs: 1 }) } as never)
    await agent.invoke({ messages: msgs })
    assert.equal(primary.calls, 1)
})

test("without fallback the error rises", async () => {
    const primary = new ScriptedModel({ script: [], failTimes: 99, failWith: transient })
    const agent = createAgent({ model: primary, tools: [], middleware: resilienceMiddleware({ modelRetryDelayMs: 1 }) } as never)
    await assert.rejects(agent.invoke({ messages: msgs }), (e: { cause?: { status?: number } }) => e.cause?.status === 503)
    assert.equal(primary.calls, 2)
})

test("tool 429 → 2 retries, then the failure becomes a message for the model", async () => {
    let attempts = 0
    const flaky = tool(async () => { attempts++; throw new Error("HTTP 429: usage limit exceeded (Retry-After: 7s)") }, { name: "dksoft_list_students", description: "x", schema: z.object({}) })
    const model = new ScriptedModel({ script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_students", args: {}, id: "1" }] }), new AIMessage("limite da API atingido")] })
    const limiter = createLimiter({ maxConcurrent: 4, perMinute: 100 })
    const agent = createAgent({ model, tools: [flaky], middleware: toolRetryAndLimiter(limiter, { toolRetryDelayMs: 1 }) })
    const out = await agent.invoke({ messages: msgs })
    assert.equal(attempts, 3)
    assert.equal(lastText(out), "limite da API atingido")
    const toolMsg = out.messages.find((m: { type?: string }) => m.type === "tool") as { content: string }
    assert.match(toolMsg.content, /429/)
})

test("a permanent tool failure is not retried", async () => {
    let attempts = 0
    const bad = tool(async () => { attempts++; throw new Error("Not found (404)") }, { name: "dksoft_find_student", description: "x", schema: z.object({}) })
    const model = new ScriptedModel({ script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_find_student", args: {}, id: "1" }] }), new AIMessage("não achei")] })
    const agent = createAgent({ model, tools: [bad], middleware: toolRetryAndLimiter(createLimiter({ maxConcurrent: 4, perMinute: 100 }), { toolRetryDelayMs: 1 }) })
    await agent.invoke({ messages: msgs })
    assert.equal(attempts, 1)
})

import { createMemoryResultStore } from "../store/memory-result-store.ts"

test("capture stores every record, the model still sees the bounded summary with resultId, and the artifact is attached", async () => {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 20000, maxBytes: 1e9 })
    const model = new ScriptedModel({
        script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_paid_bills", args: { data_inicial: "2026-10-01", data_final: "2026-10-31" }, id: "1" }] }), new AIMessage("ok")],
    })
    const tracker: RunTracker = { partial: false, toolCalls: 0, model: null }
    const withContact = tool(async () => JSON.stringify(Array.from({ length: 400 }, (_, i) => ({ id: i, valor_pago: 1.5, cpf: "12345678909" }))), { name: "dksoft_list_paid_bills", description: "x", schema: z.object({}).passthrough() })
    const agent = createAgent({ model, tools: [withContact], middleware: [shapeResultsMiddleware({ maxRows: 40, maxChars: 24000 }, tracker, { conversationId: "c1", results, newId: () => "11111111-1111-4111-8111-111111111111" })] })
    const out = await agent.invoke({ messages: [{ role: "user", content: "oi" }] })
    const toolMsg = out.messages.find((m: { type?: string }) => m.type === "tool") as unknown as { content: string; artifact: Record<string, unknown> }
    const parsed = JSON.parse(toolMsg.content)
    assert.equal(parsed.resultId, "11111111-1111-4111-8111-111111111111")
    assert.equal(parsed.registros.length, 40)
    assert.ok(!toolMsg.content.includes("12345678909"), "model never sees contact data of list_*")
    const stored = results.get("c1", parsed.resultId)!
    assert.equal(stored.rows.length, 400)
    assert.equal(stored.rows[0]!.cpf, "12345678909", "complete records are kept for the file")
    assert.equal(stored.label, "Contas pagas, 01/10/2026 a 31/10/2026")
    assert.deepEqual(toolMsg.artifact, { kind: "result", resultId: parsed.resultId, label: stored.label, rows: 400, totalRows: 400, capped: false, expiresAt: stored.expiresAt })
    assert.equal(tracker.partial, true)
})

test("errors and non-list results are not captured", async () => {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 100, maxBytes: 1e9 })
    const one = tool(async () => JSON.stringify({ id: 1, nome: "Ana" }), { name: "dksoft_find_student", description: "x", schema: z.object({}) })
    const model = new ScriptedModel({ script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_find_student", args: {}, id: "1" }] }), new AIMessage("ok")] })
    const tracker: RunTracker = { partial: false, toolCalls: 0, model: null }
    const agent = createAgent({ model, tools: [one], middleware: [shapeResultsMiddleware({ maxRows: 40, maxChars: 24000 }, tracker, { conversationId: "c1", results, newId: () => "x" })] })
    const out = await agent.invoke({ messages: [{ role: "user", content: "oi" }] })
    const toolMsg = out.messages.find((m: { type?: string }) => m.type === "tool") as unknown as { content: string; artifact?: unknown }
    assert.equal(results.list("c1").length, 0)
    assert.equal(toolMsg.artifact, undefined)
    assert.ok(!("resultId" in JSON.parse(toolMsg.content)))
})
