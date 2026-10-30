import { createMiddleware, modelFallbackMiddleware, modelRetryMiddleware, toolRetryMiddleware, type AnyAgentMiddleware } from "langchain"
import type { BaseChatModel } from "@langchain/core/language_models/chat_models"
import { maskPii } from "../domain/mask-pii.ts"
import { isTransientModelError } from "../domain/model-errors.ts"
import type { Limiter } from "../services/limiter.ts"
import { ToolMessage } from "@langchain/core/messages"
import { shapeToolResult, type ShapeLimits } from "../domain/shape-result.ts"

export type RunTracker = { partial: boolean; toolCalls: number; model: string | null }

export const DEFAULT_MAX_CHARS = 24000

function contentToText(content: ToolMessage["content"]): string | undefined {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
        const texts = content.flatMap((b) => (b && typeof b === "object" && "text" in b && typeof b.text === "string" ? [b.text] : []))
        return texts.length ? texts.join("\n") : undefined
    }
    return undefined
}

// bounds every tool result before it reaches the model (exact totals, row cut, partial flag)
export function shapeResultsMiddleware(limits: ShapeLimits, tracker: RunTracker) {
    return createMiddleware({
        name: "ShapeResults",
        wrapToolCall: async (request, handler) => {
            tracker.toolCalls++
            const result = await handler(request)
            if (!ToolMessage.isInstance(result) || result.status === "error") return result
            const raw = contentToText(result.content)
            if (raw === undefined) return result
            const shaped = shapeToolResult(request.toolCall.name, raw, limits)
            if (shaped.truncated) tracker.partial = true
            return new ToolMessage({ content: shaped.text, tool_call_id: result.tool_call_id, name: result.name, status: result.status })
        },
    })
}

// tools that call the MCP tool once per window already take a limiter slot per window (no nested slots)
export const LIMITER_EXEMPT_TOOLS: readonly string[] = ["financeiro_contas_pagas_periodo", "financeiro_contas_recebidas_periodo"]

export type ResilienceOptions = { fallbackModel?: BaseChatModel | undefined; modelRetryDelayMs?: number; toolRetryDelayMs?: number }

// order matters: fallback outside, retry inside; `onFailure: "error"` is mandatory, otherwise the fallback never runs
export function resilienceMiddleware(opts: ResilienceOptions): AnyAgentMiddleware[] {
    const list: AnyAgentMiddleware[] = []
    if (opts.fallbackModel) list.push(modelFallbackMiddleware(opts.fallbackModel) as AnyAgentMiddleware)
    list.push(
        modelRetryMiddleware({
            maxRetries: 1,
            retryOn: isTransientModelError,
            onFailure: "error",
            initialDelayMs: opts.modelRetryDelayMs ?? 1000,
            jitter: false,
        }) as AnyAgentMiddleware,
    )
    return list
}

const TOOL_RETRYABLE = /HTTP (429|5\d\d)\b|ECONNRESET|ETIMEDOUT|ECONNREFUSED/

export function isTransientToolError(err: Error): boolean {
    return TOOL_RETRYABLE.test(err.message)
}

// retry only 429/5xx; after the retries the failure becomes a message for the model (onFailure "continue")
export function toolRetryAndLimiter(limiter: Limiter, opts: { toolRetryDelayMs?: number } = {}): AnyAgentMiddleware[] {
    return [
        toolRetryMiddleware({
            maxRetries: 2,
            retryOn: isTransientToolError,
            onFailure: (err: Error) => `A consulta falhou: ${maskPii(err.message)}`,
            initialDelayMs: opts.toolRetryDelayMs ?? 1000,
            jitter: false,
        }) as AnyAgentMiddleware,
        createMiddleware({
            name: "ToolLimiter",
            wrapToolCall: async (request, handler) => {
                if (LIMITER_EXEMPT_TOOLS.includes(request.toolCall.name)) return handler(request)
                return limiter.run(async () => handler(request))
            },
        }) as AnyAgentMiddleware,
    ]
}

function modelNameOf(model: unknown): string | null {
    const m = model as { model?: unknown; modelName?: unknown }
    if (typeof m?.model === "string") return m.model
    if (typeof m?.modelName === "string") return m.modelName
    return null
}

// innermost model middleware: remembers which model produced the last successful answer
export function modelTracker(tracker: RunTracker): AnyAgentMiddleware {
    return createMiddleware({
        name: "ModelTracker",
        wrapModelCall: async (request, handler) => {
            const res = await handler(request)
            tracker.model = modelNameOf(request.model) ?? tracker.model
            return res
        },
    }) as AnyAgentMiddleware
}
