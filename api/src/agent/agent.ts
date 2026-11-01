import { createAgent, type AnyAgentMiddleware } from "langchain"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { StructuredToolInterface } from "@langchain/core/tools"
import { AIMessage, AIMessageChunk, ToolMessage } from "@langchain/core/messages"
import { ChartSpecSchema } from "../domain/chart-spec.ts"
import { FileDescriptorSchema } from "../domain/file-descriptor.ts"
import type { AgentEvent, AgentInput, AgentRunner, ResultNotice } from "../domain/agent-port.ts"
import { z } from "zod"
import type { ShapeLimits } from "../domain/shape-result.ts"
import { buildSystemPrompt } from "../domain/system-prompt.ts"
import type { Limiter } from "../services/limiter.ts"
import { AGENT_RECURSION_LIMIT, modelTracker, resilienceMiddleware, shapeResultsMiddleware, toolCallLimit, toolRetryAndLimiter, type RunTracker } from "./middleware.ts"
import type { ResultStore } from "../services/result-store.repository.ts"
import type { ArtifactToolContext } from "./artifact-tools.ts"
import { composeTools } from "./tools.ts"

export type AgentRunnerDeps = {
    model: BaseChatModel
    modelName: string
    tools: StructuredToolInterface[]
    limits: ShapeLimits
    // extra middlewares (resilience, limiter, model tracking), built per run so they can share the tracker
    extraMiddleware?: (tracker: RunTracker) => AnyAgentMiddleware[]
    now?: () => Date
    // local tools (results, charts, files) and the capture of complete query results; off = MVP behaviour
    artifacts?: { buildTools(ctx: ArtifactToolContext): StructuredToolInterface[]; results: ResultStore; newId: () => string }
}

const ResultArtifactSchema = z.object({
    kind: z.literal("result"), resultId: z.string().uuid(), label: z.string(), rows: z.number().int().min(1), totalRows: z.number().int().min(1), capped: z.boolean(), expiresAt: z.string(),
})

// validates the artifact of a finished tool call; an invalid artifact yields no event (the text still reaches the person)
export function artifactEvent(name: string, artifact: unknown): AgentEvent | undefined {
    if (artifact === undefined || artifact === null) return undefined
    const r = ResultArtifactSchema.safeParse(artifact)
    if (r.success) {
        const { kind: _kind, ...notice } = r.data
        return { type: "result", result: notice satisfies ResultNotice }
    }
    if (name === "gerar_grafico") { const c = ChartSpecSchema.safeParse(artifact); return c.success ? { type: "chart", chart: c.data } : undefined }
    if (name === "exportar_arquivo") { const f = FileDescriptorSchema.safeParse(artifact); return f.success ? { type: "file", file: f.data } : undefined }
    return undefined
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
            const art = input.conversationId ? deps.artifacts : undefined
            const extraTools = art && input.conversationId ? art.buildTools({ conversationId: input.conversationId, userMessage: input.message, requestId: input.requestId ?? "" }) : []
            const capture = art && input.conversationId ? { conversationId: input.conversationId, results: art.results, newId: art.newId } : undefined
            const agent = createAgent({
                model: deps.model,
                tools: [...deps.tools, ...extraTools],
                systemPrompt: buildSystemPrompt((deps.now?.() ?? new Date()).toISOString().slice(0, 10), { artifacts: art !== undefined }),
                middleware: [...(deps.extraMiddleware?.(tracker) ?? []), shapeResultsMiddleware(deps.limits, tracker, capture)] as AnyAgentMiddleware[],
            })
            const stream = await agent.stream(
                { messages: [...input.history, { role: "user", content: input.message }] },
                { streamMode: ["messages", "updates"], signal: input.signal, recursionLimit: AGENT_RECURSION_LIMIT },
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
                                if (m.status !== "error") { const ev = artifactEvent(m.name ?? "", m.artifact); if (ev) yield ev }
                            }
                        }
                    }
                }
            }
            yield { type: "end", model: tracker.model, partial: tracker.partial, toolCalls: tracker.toolCalls }
        },
    }
}

export type ProductionAgentDeps = {
    model: BaseChatModel
    modelName: string
    fallbackModel?: BaseChatModel | undefined
    mcpTools: StructuredToolInterface[]
    limiter: Limiter
    limits: ShapeLimits
    now?: () => Date
    retryDelays?: { model?: number; tool?: number }
    artifacts?: AgentRunnerDeps["artifacts"]
}

// full composition: period tools, model retry + fallback, tool retry + limiter, model tracking, result shaping
export function createProductionAgent(deps: ProductionAgentDeps): AgentRunner {
    return createAgentRunner({
        model: deps.model,
        modelName: deps.modelName,
        tools: composeTools(deps.mcpTools, deps.limiter),
        limits: deps.limits,
        ...(deps.now ? { now: deps.now } : {}),
        ...(deps.artifacts ? { artifacts: deps.artifacts } : {}),
        extraMiddleware: (tracker) => [
            ...resilienceMiddleware({ fallbackModel: deps.fallbackModel, ...(deps.retryDelays?.model !== undefined ? { modelRetryDelayMs: deps.retryDelays.model } : {}) }),
            toolCallLimit(tracker),
            ...toolRetryAndLimiter(deps.limiter, deps.retryDelays?.tool !== undefined ? { toolRetryDelayMs: deps.retryDelays.tool } : {}),
            modelTracker(tracker),
        ],
    })
}
