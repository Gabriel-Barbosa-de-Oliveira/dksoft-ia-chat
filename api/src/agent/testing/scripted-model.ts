import { AIMessage, AIMessageChunk, type BaseMessage } from "@langchain/core/messages"
import { BaseChatModel } from "@langchain/core/language_models/chat_models"
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager"
import { ChatGenerationChunk, type ChatResult } from "@langchain/core/outputs"

export type ScriptedModelOptions = {
    name?: string
    script: AIMessage[]
    failTimes?: number
    failWith?: unknown
    // when set, the call never finishes until the signal aborts (timeout tests)
    hang?: boolean
}

// fake chat model for tests: scripted answers/tool calls, optional failures, per-token streaming
export class ScriptedModel extends BaseChatModel {
    readonly modelName: string
    calls = 0
    private readonly script: AIMessage[]
    private readonly failTimes: number
    private readonly failWith: unknown
    private readonly hang: boolean

    constructor(opts: ScriptedModelOptions) {
        super({})
        this.modelName = opts.name ?? "scripted"
        this.script = [...opts.script]
        this.failTimes = opts.failTimes ?? 0
        this.failWith = opts.failWith
        this.hang = opts.hang ?? false
    }

    _llmType(): string { return "scripted" }
    bindTools(): this { return this }

    private next(): AIMessage {
        this.calls++
        if (this.calls <= this.failTimes) throw this.failWith
        return this.script.shift() ?? new AIMessage("fim")
    }

    private async maybeHang(signal?: AbortSignal): Promise<void> {
        if (!this.hang) return
        await new Promise<void>((_, reject) => {
            const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
            if (signal?.aborted) abort()
            signal?.addEventListener("abort", abort, { once: true })
        })
    }

    async _generate(_messages: BaseMessage[], options?: this["ParsedCallOptions"]): Promise<ChatResult> {
        await this.maybeHang(options?.signal)
        const next = this.next()
        return { generations: [{ text: typeof next.content === "string" ? next.content : "", message: next }] }
    }

    async *_streamResponseChunks(_messages: BaseMessage[], options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): AsyncGenerator<ChatGenerationChunk> {
        await this.maybeHang(options?.signal)
        const next = this.next()
        if (next.tool_calls?.length) {
            yield new ChatGenerationChunk({
                text: "",
                message: new AIMessageChunk({
                    content: "",
                    tool_call_chunks: next.tool_calls.map((c, i) => ({ name: c.name, args: JSON.stringify(c.args), id: c.id, index: i })),
                }),
            })
            return
        }
        for (const piece of String(next.content).split(/(?<= )/)) {
            const chunk = new ChatGenerationChunk({ text: piece, message: new AIMessageChunk({ content: piece }) })
            yield chunk
            await runManager?.handleLLMNewToken(piece)
        }
    }
}
