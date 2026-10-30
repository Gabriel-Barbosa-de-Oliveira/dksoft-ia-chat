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
