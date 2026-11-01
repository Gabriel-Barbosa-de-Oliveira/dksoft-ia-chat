import type { ChartSpec } from "./chart-spec.ts"
import type { FileDescriptor } from "./file-descriptor.ts"

export type ChatTurn = { role: "user" | "assistant"; content: string }

export type ResultNotice = { resultId: string; label: string; rows: number; totalRows: number; capped: boolean; expiresAt: string }

export type AgentEvent =
    | { type: "result"; result: ResultNotice }
    | { type: "chart"; chart: ChartSpec }
    | { type: "file"; file: FileDescriptor }
    | { type: "tool"; phase: "start" | "end"; name: string; ok?: boolean }
    | { type: "token"; text: string }
    | { type: "end"; model: string | null; partial: boolean; toolCalls: number }

export type AgentInput = { history: ChatTurn[]; message: string; signal: AbortSignal; conversationId?: string; requestId?: string }

// contract between services/ and agent/
export interface AgentRunner {
    run(input: AgentInput): AsyncIterable<AgentEvent>
}
