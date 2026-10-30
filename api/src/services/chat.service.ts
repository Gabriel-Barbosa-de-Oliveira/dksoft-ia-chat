import { randomUUID } from "node:crypto"
import type { AgentRunner } from "../domain/agent-port.ts"
import { ChatTimeoutError, ConversationNotFoundError } from "../domain/errors.ts"
import type { StreamEvent } from "../domain/events.ts"
import { classifyAgentError } from "../domain/model-errors.ts"
import { toolLabel } from "../domain/tool-labels.ts"
import type { ConversationLock } from "./conversation-lock.ts"
import type { ConversationStore } from "./conversation-store.repository.ts"
import type { RunOutcome, RunStore } from "./run-store.repository.ts"

export type ChatServiceDeps = {
    agent: AgentRunner
    conversations: ConversationStore
    runs: RunStore
    lock: ConversationLock
    historyLimit: number
    timeoutMs: number
    now?: () => number
    newId?: () => string
}

export type ChatStart = { requestId: string; conversationId: string; events: AsyncIterable<StreamEvent> }

export function createChatService(deps: ChatServiceDeps) {
    const now = deps.now ?? Date.now
    const newId = deps.newId ?? randomUUID

    return {
        // validates and prepares the conversation BEFORE the stream opens (throws ConversationNotFoundError)
        start(input: { message: string; conversationId?: string | undefined; requestId?: string; signal?: AbortSignal }): ChatStart {
            const requestId = input.requestId ?? newId()
            if (input.conversationId !== undefined && !deps.conversations.exists(input.conversationId)) {
                throw new ConversationNotFoundError(input.conversationId)
            }
            const conversationId = input.conversationId ?? deps.conversations.create()
            const clientSignal = input.signal ?? new AbortController().signal

            async function* events(): AsyncGenerator<StreamEvent> {
                yield { event: "meta", data: { requestId, conversationId } }
                const release = await deps.lock.acquire(conversationId)
                const startedMs = now()
                const startedAt = new Date(startedMs).toISOString()
                let outcome: RunOutcome = "aborted" // stays so if the consumer stops iterating early
                let modelUsed: string | null = null
                let toolCalls = 0
                let errorType: string | null = null
                let timer: ReturnType<typeof setTimeout> | undefined
                try {
                    if (clientSignal.aborted) { outcome = "aborted"; return }
                    const timeoutCtl = new AbortController()
                    timer = setTimeout(() => timeoutCtl.abort(), deps.timeoutMs)
                    const timeoutSignal = timeoutCtl.signal
                    const signal = AbortSignal.any([timeoutSignal, clientSignal])
                    const history = deps.conversations.lastMessages(conversationId, deps.historyLimit)
                    let answer = ""
                    let partial = false
                    try {
                        for await (const ev of deps.agent.run({ history, message: input.message, signal })) {
                            if (ev.type === "token") { answer += ev.text; yield { event: "token", data: { text: ev.text } } }
                            else if (ev.type === "tool") {
                                yield { event: "tool", data: { phase: ev.phase, name: ev.name, label: toolLabel(ev.name), ...(ev.ok !== undefined ? { ok: ev.ok } : {}) } }
                            } else { modelUsed = ev.model; partial = ev.partial; toolCalls = ev.toolCalls }
                        }
                    } catch (err) {
                        if (clientSignal.aborted) { outcome = "aborted"; return }
                        if (timeoutSignal.aborted) throw new ChatTimeoutError()
                        throw classifyAgentError(err)
                    }
                    if (clientSignal.aborted) { outcome = "aborted"; return }
                    if (timeoutSignal.aborted) throw new ChatTimeoutError()
                    if (answer.trim() === "") throw new Error("empty answer")
                    deps.conversations.appendPair(conversationId, input.message, answer)
                    outcome = "ok"
                    yield { event: "done", data: { requestId, conversationId, model: modelUsed, durationMs: now() - startedMs, partial } }
                } catch (err) {
                    outcome = err instanceof ChatTimeoutError ? "timeout" : "error"
                    errorType = err instanceof Error ? err.name : "UnknownError"
                    throw err // translation to the `error` event happens at the border (http)
                } finally {
                    clearTimeout(timer)
                    release()
                    deps.runs.save({
                        requestId, conversationId, startedAt, durationMs: Math.max(0, now() - startedMs), outcome, modelUsed, toolCalls, errorType,
                    })
                }
            }
            return { requestId, conversationId, events: events() }
        },
    }
}

export type ChatService = ReturnType<typeof createChatService>
