export type RunOutcome = "ok" | "error" | "timeout" | "aborted"

export type RunRecord = {
    requestId: string
    conversationId: string | null
    startedAt: string
    durationMs: number
    outcome: RunOutcome
    modelUsed: string | null
    toolCalls: number
    errorType: string | null
}

export interface RunStore {
    save(run: RunRecord): void
}
