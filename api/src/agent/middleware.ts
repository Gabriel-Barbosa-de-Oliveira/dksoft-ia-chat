import { createMiddleware } from "langchain"
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
