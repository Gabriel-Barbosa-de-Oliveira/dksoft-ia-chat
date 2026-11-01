import assert from "node:assert/strict"
import { test } from "node:test"
import { tool } from "langchain"
import { AIMessage } from "@langchain/core/messages"
import { z } from "zod"
import type { AgentEvent } from "../domain/agent-port.ts"
import { ScriptedModel } from "./testing/scripted-model.ts"
import { createAgentRunner } from "./agent.ts"

const students = tool(async () => JSON.stringify([{ id: 1 }]), { name: "dksoft_list_students", description: "x", schema: z.object({}) })
const limits = { maxRows: 40, maxChars: 24000 }

async function collect(runner: ReturnType<typeof createAgentRunner>, message = "oi") {
    const events: AgentEvent[] = []
    for await (const e of runner.run({ history: [], message, signal: new AbortController().signal })) events.push(e)
    return events
}

test("tool start/end come before tokens; tokens arrive in separate pieces", async () => {
    const model = new ScriptedModel({
        script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_students", args: {}, id: "1" }] }), new AIMessage("Há um aluno cadastrado.")],
    })
    const events = await collect(createAgentRunner({ model, modelName: "m", tools: [students], limits }))
    const kinds = events.map((e) => (e.type === "tool" ? `tool:${e.phase}` : e.type))
    assert.deepEqual(kinds.slice(0, 2), ["tool:start", "tool:end"])
    const tokens = events.filter((e) => e.type === "token")
    assert.ok(tokens.length >= 3, "streamed in pieces")
    assert.equal(tokens.map((t) => (t as { text: string }).text).join(""), "Há um aluno cadastrado.")
    assert.deepEqual(events.at(-1), { type: "end", model: "m", partial: false, toolCalls: 1 })
})

test("a tool call without text produces no token", async () => {
    const model = new ScriptedModel({
        script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_students", args: {}, id: "1" }] }), new AIMessage("ok")],
    })
    const events = await collect(createAgentRunner({ model, modelName: "m", tools: [students], limits }))
    const firstToken = events.findIndex((e) => e.type === "token")
    const lastTool = events.findLastIndex((e) => e.type === "tool")
    assert.ok(firstToken > lastTool)
})

test("history is passed to the model", async () => {
    const model = new ScriptedModel({ script: [new AIMessage("resposta")] })
    const events: AgentEvent[] = []
    for await (const e of createAgentRunner({ model, modelName: "m", tools: [], limits }).run({
        history: [{ role: "user", content: "antes" }, { role: "assistant", content: "ok" }], message: "agora", signal: new AbortController().signal,
    })) events.push(e)
    assert.ok(events.some((e) => e.type === "token"))
})

import { artifactEvent } from "./agent.ts"
import { createMemoryResultStore } from "../store/memory-result-store.ts"
import { createArtifactToolBuilder } from "./artifact-tools.ts"
import { MIME_BY_FORMAT } from "../domain/file-descriptor.ts"

const R1 = "11111111-1111-4111-8111-111111111111"
const paid = tool(async () => JSON.stringify(Array.from({ length: 3 }, (_, i) => ({ id_aluno: i, valor_pago: 10, banco: i === 0 ? "A" : "B" }))), { name: "dksoft_list_paid_bills", description: "x", schema: z.object({}).passthrough() })

function artifactSetup() {
    const results = createMemoryResultStore({ ttlMs: 3_600_000, maxRows: 100, maxBytes: 1e9 })
    const exportCalls: unknown[] = []
    const exports = {
        export: async (r: { conversationId: string; resultId?: string; format: "pdf" | "xlsx" | "docx" }) => {
            exportCalls.push(r)
            return { id: R1, conversationId: r.conversationId, resultId: r.resultId ?? R1, name: "a.xlsx", format: r.format, mime: MIME_BY_FORMAT[r.format], sizeBytes: 5, rowCount: 3, includesChart: false, containsFullPersonalData: false, createdAt: "2026-10-31T21:00:00.000Z", expiresAt: "2026-10-31T21:30:00.000Z", downloadPath: "/p" }
        },
    }
    const charts = { create: () => { throw new Error("unused") } }
    const buildTools = createArtifactToolBuilder({ results, exports: exports as never, charts: charts as never })
    return { results, exportCalls, artifacts: { buildTools, results, newId: () => R1 } }
}

test("query then export: tool, result, tool, file in order; the model never sees records beyond the summary", async () => {
    const t = artifactSetup()
    const model = new ScriptedModel({
        script: [
            new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_paid_bills", args: { data_inicial: "2026-10-01", data_final: "2026-10-31" }, id: "1" }] }),
            new AIMessage({ content: "", tool_calls: [{ name: "exportar_arquivo", args: { formato: "xlsx" }, id: "2" }] }),
            new AIMessage("Arquivo pronto."),
        ],
    })
    const runner = createAgentRunner({ model, modelName: "m", tools: [paid], limits, artifacts: t.artifacts })
    const events: AgentEvent[] = []
    for await (const e of runner.run({ history: [], message: "exporta em excel", signal: new AbortController().signal, conversationId: R1, requestId: "q" })) events.push(e)
    const kinds = events.filter((e) => e.type !== "token").map((e) => (e.type === "tool" ? `tool:${e.phase}:${e.name}` : e.type))
    assert.deepEqual(kinds, ["tool:start:dksoft_list_paid_bills", "tool:end:dksoft_list_paid_bills", "result", "tool:start:exportar_arquivo", "tool:end:exportar_arquivo", "file", "end"])
    const result = events.find((e) => e.type === "result")
    assert.ok(result && result.type === "result" && result.result.rows === 3 && result.result.label === "Contas pagas, 01/10/2026 a 31/10/2026")
    const file = events.find((e) => e.type === "file")
    assert.ok(file && file.type === "file" && file.file.name === "a.xlsx")
    assert.equal((t.exportCalls[0] as { conversationId: string }).conversationId, R1)
})
test("without `artifacts` nothing changes: no extra tools, no events, no resultId in the summary", async () => {
    const model = new ScriptedModel({ script: [new AIMessage({ content: "", tool_calls: [{ name: "dksoft_list_paid_bills", args: {}, id: "1" }] }), new AIMessage("ok")] })
    const events: AgentEvent[] = []
    for await (const e of createAgentRunner({ model, modelName: "m", tools: [paid], limits }).run({ history: [], message: "oi", signal: new AbortController().signal, conversationId: "c1" })) events.push(e)
    assert.deepEqual(events.filter((e) => ["result", "chart", "file"].includes(e.type)), [])
})
test("invalid artifacts yield no event; valid ones map to the right event", () => {
    assert.equal(artifactEvent("gerar_grafico", { nope: 1 }), undefined)
    assert.equal(artifactEvent("exportar_arquivo", { nope: 1 }), undefined)
    assert.equal(artifactEvent("outra", { kind: "x" }), undefined)
    assert.equal(artifactEvent("x", undefined), undefined)
    const ev = artifactEvent("dksoft_list_paid_bills", { kind: "result", resultId: R1, label: "l", rows: 2, totalRows: 5, capped: true, expiresAt: "z" })
    assert.deepEqual(ev, { type: "result", result: { resultId: R1, label: "l", rows: 2, totalRows: 5, capped: true, expiresAt: "z" } })
})
