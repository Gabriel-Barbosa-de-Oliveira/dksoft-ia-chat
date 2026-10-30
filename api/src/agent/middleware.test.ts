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
