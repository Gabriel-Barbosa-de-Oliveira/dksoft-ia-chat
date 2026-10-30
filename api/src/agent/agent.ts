import { createAgent, type AnyAgentMiddleware } from "langchain"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { StructuredToolInterface } from "@langchain/core/tools"
import { AIMessage, AIMessageChunk, ToolMessage } from "@langchain/core/messages"
import type { AgentEvent, AgentInput, AgentRunner } from "../domain/agent-port.ts"
import type { ShapeLimits } from "../domain/shape-result.ts"
import { buildSystemPrompt } from "../domain/system-prompt.ts"
import { shapeResultsMiddleware, type RunTracker } from "./middleware.ts"

export type AgentRunnerDeps = {
    model: BaseChatModel
    modelName: string
    tools: StructuredToolInterface[]
    limits: ShapeLimits
    // extra middlewares (resilience, limiter, model tracking), built per run so they can share the tracker
    extraMiddleware?: (tracker: RunTracker) => AnyAgentMiddleware[]
    now?: () => Date
}

function chunkText(chunk: AIMessageChunk): string {
    if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) return ""
    const c = chunk.content
    if (typeof c === "string") return c
    if (Array.isArray(c)) return c.map((b) => (b && typeof b === "object" && "text" in b && typeof b.text === "string" ? b.text : "")).join("")
    return ""
}

export function createAgentRunner(deps: AgentRunnerDeps): AgentRunner {
    return {
        async *run(input: AgentInput): AsyncGenerator<AgentEvent> {
            const tracker: RunTracker = { partial: false, toolCalls: 0, model: deps.modelName }
            const agent = createAgent({
                model: deps.model,
                tools: deps.tools,
                systemPrompt: buildSystemPrompt((deps.now?.() ?? new Date()).toISOString().slice(0, 10)),
                middleware: [...(deps.extraMiddleware?.(tracker) ?? []), shapeResultsMiddleware(deps.limits, tracker)] as AnyAgentMiddleware[],
            })
            const stream = await agent.stream(
                { messages: [...input.history, { role: "user", content: input.message }] },
                { streamMode: ["messages", "updates"], signal: input.signal },
            )
            for await (const item of stream as AsyncIterable<[string, unknown]>) {
                const [mode, data] = item
                if (mode === "messages") {
                    const [chunk] = data as [unknown, unknown]
                    if (AIMessageChunk.isInstance(chunk)) {
                        const text = chunkText(chunk)
                        if (text) yield { type: "token", text }
                    }
                } else if (mode === "updates") {
                    for (const update of Object.values(data as Record<string, { messages?: unknown[] } | undefined>)) {
                        for (const m of update?.messages ?? []) {
                            if (AIMessage.isInstance(m) || AIMessageChunk.isInstance(m)) {
                                for (const call of m.tool_calls ?? []) yield { type: "tool", phase: "start", name: call.name }
                            } else if (ToolMessage.isInstance(m)) {
                                yield { type: "tool", phase: "end", name: m.name ?? "tool", ok: m.status !== "error" }
                            }
                        }
                    }
                }
            }
            yield { type: "end", model: tracker.model, partial: tracker.partial, toolCalls: tracker.toolCalls }
        },
    }
}
