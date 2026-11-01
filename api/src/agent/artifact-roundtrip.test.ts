import assert from "node:assert/strict"
import { test } from "node:test"
import { createAgent, tool } from "langchain"
import { AIMessage, ToolMessage } from "@langchain/core/messages"
import { z } from "zod"
import { ScriptedModel } from "./testing/scripted-model.ts"
import { shapeResultsMiddleware, type RunTracker } from "./middleware.ts"

// R1: o artefato da tool chega ao ToolMessage do modo `updates`, mesmo com o middleware reconstruindo a mensagem
const withArtifact = tool(async () => ["texto para o modelo", { kind: "demo", n: 1 }], {
    name: "demo_artifact", description: "x", schema: z.object({}), responseFormat: "content_and_artifact",
})

test("artifact survives createAgent + shapeResultsMiddleware and the model sees only the text", async () => {
    const model = new ScriptedModel({
        script: [new AIMessage({ content: "", tool_calls: [{ name: "demo_artifact", args: {}, id: "1" }] }), new AIMessage("ok")],
    })
    const tracker: RunTracker = { partial: false, toolCalls: 0, model: "m" }
    const agent = createAgent({ model, tools: [withArtifact], middleware: [shapeResultsMiddleware({ maxRows: 40, maxChars: 24000 }, tracker)] as never })
    const stream = await agent.stream({ messages: [{ role: "user", content: "oi" }] } as never, { streamMode: ["updates"] } as never)
    const tools: ToolMessage[] = []
    for await (const item of stream as AsyncIterable<[string, Record<string, { messages?: unknown[] }>]>) {
        for (const upd of Object.values(item[1])) for (const m of upd?.messages ?? []) if (ToolMessage.isInstance(m)) tools.push(m)
    }
    assert.equal(tools.length, 1)
    assert.deepEqual(tools[0]!.artifact, { kind: "demo", n: 1 })
    assert.equal(tools[0]!.content, "texto para o modelo")
})
