import type { ChatTurn } from "../domain/agent-port.ts"

export type ConversationSummary = { id: string; createdAt: string; updatedAt: string }
export type StoredMessage = { id: number; role: "user" | "assistant"; content: string; createdAt: string }

export interface ConversationStore {
    create(): string
    exists(id: string): boolean
    lastMessages(id: string, n: number): ChatTurn[]
    appendPair(id: string, user: string, assistant: string): void
    listConversations(limit: number, offset: number): ConversationSummary[]
    listMessages(id: string): StoredMessage[]
}
