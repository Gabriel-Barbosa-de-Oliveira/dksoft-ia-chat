import assert from "node:assert/strict"
import { test } from "node:test"
import { createAgent, tool } from "langchain"
import { AIMessage } from "@langchain/core/messages"
import { z } from "zod"
import { ScriptedModel } from "./testing/scripted-model.ts"
import { shapeResultsMiddleware, type RunTracker } from "./middleware.ts"

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
