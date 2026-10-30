import type { AddressInfo } from "node:net"
import type { AgentEvent, AgentInput, AgentRunner } from "../domain/agent-port.ts"
import { createChatService } from "../services/chat.service.ts"
import { createConversationLock } from "../services/conversation-lock.ts"
import { openDatabase } from "../store/db.ts"
import { createSqliteConversationStore } from "../store/sqlite-conversation-store.ts"
import { createSqliteRunStore } from "../store/sqlite-run-store.ts"
import { createApp } from "./app.ts"

export const ACCESS_KEY = "k".repeat(40)
export const ORIGIN = "http://localhost:5173"

export type FakeAgent = (input: AgentInput) => AsyncGenerator<AgentEvent>

export const simpleAgent = (text = "Resposta de teste."): FakeAgent => async function* () {
    yield { type: "tool", phase: "start", name: "dksoft_list_students" }
    yield { type: "tool", phase: "end", name: "dksoft_list_students", ok: true }
    for (const t of text.split(/(?<= )/)) yield { type: "token", text: t }
    yield { type: "end", model: "fake/model", partial: false, toolCalls: 1 }
}

// test harness: app + in-memory stores + fake agent; `listen` starts a real server on a free port
export async function buildTestApp(opts: { agent?: FakeAgent; rateLimit?: number; timeoutMs?: number; logSink?: { write(c: string): void } } = {}) {
    const db = openDatabase(":memory:")
    let tick = 0
    const conversations = createSqliteConversationStore(db, () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)))
    const agent: AgentRunner = { run: (i) => (opts.agent ?? simpleAgent())(i) }
    const chat = createChatService({ agent, conversations, runs: createSqliteRunStore(db), lock: createConversationLock(), historyLimit: 12, timeoutMs: opts.timeoutMs ?? 5000 })
    const app = await createApp({
        ...(opts.logSink ? { logSink: opts.logSink } : { logger: false }),
        chat, conversations, accessKey: ACCESS_KEY, corsOrigins: [ORIGIN], chatRateLimitPerMin: opts.rateLimit ?? 1000,
    })
    return {
        app, db, conversations,
        async listen() {
            await app.listen({ port: 0, host: "127.0.0.1" })
            return `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
        },
    }
}

export const auth = { authorization: `Bearer ${ACCESS_KEY}` }

export async function readSse(res: Response): Promise<{ event: string; data: Record<string, unknown> }[]> {
    const text = await res.text()
    return text.split("\n\n").filter(Boolean).map((frame) => {
        const event = /^event: (.+)$/m.exec(frame)![1]!
        const data = JSON.parse(/^data: (.+)$/m.exec(frame)![1]!) as Record<string, unknown>
        return { event, data }
    })
}
