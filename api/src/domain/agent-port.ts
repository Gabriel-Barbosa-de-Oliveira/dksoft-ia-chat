export type ChatTurn = { role: "user" | "assistant"; content: string }

export type AgentEvent =
    | { type: "tool"; phase: "start" | "end"; name: string; ok?: boolean }
    | { type: "token"; text: string }
    | { type: "end"; model: string | null; partial: boolean; toolCalls: number }

export type AgentInput = { history: ChatTurn[]; message: string; signal: AbortSignal }

// contract between services/ and agent/
export interface AgentRunner {
    run(input: AgentInput): AsyncIterable<AgentEvent>
}
