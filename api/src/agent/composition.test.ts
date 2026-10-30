import assert from "node:assert/strict"
import { test } from "node:test"
import { tool } from "langchain"
import { AIMessage } from "@langchain/core/messages"
import { z } from "zod"
import type { StreamEvent } from "../domain/events.ts"
import { createChatService } from "../services/chat.service.ts"
import { createConversationLock } from "../services/conversation-lock.ts"
import { createLimiter } from "../services/limiter.ts"
import { openDatabase } from "../store/db.ts"
import { createSqliteConversationStore } from "../store/sqlite-conversation-store.ts"
import { createSqliteRunStore } from "../store/sqlite-run-store.ts"
import { createProductionAgent } from "./agent.ts"
import { ScriptedModel } from "./testing/scripted-model.ts"

const schema = z.object({ data_inicial: z.string(), data_final: z.string(), aluno: z.string().optional(), pacote: z.string().optional() })
const call = (name: string, args: Record<string, unknown>) => new AIMessage({ content: "", tool_calls: [{ name, args, id: "c1" }] })

function build(opts: { primary: ScriptedModel; fallback?: ScriptedModel; paid: (args: Record<string, unknown>) => Promise<string> }) {
    const paid = tool(opts.paid, { name: "dksoft_list_paid_bills", description: "x", schema })
    const agent = createProductionAgent({
        model: opts.primary, modelName: "principal", fallbackModel: opts.fallback,
        mcpTools: [paid] as never, limiter: createLimiter({ maxConcurrent: 4, perMinute: 100 }),
        limits: { maxRows: 40, maxChars: 24000 }, retryDelays: { model: 1, tool: 1 },
    })
    const db = openDatabase(":memory:")
    const service = createChatService({ agent, conversations: createSqliteConversationStore(db), runs: createSqliteRunStore(db), lock: createConversationLock(), historyLimit: 12, timeoutMs: 10000 })
    return { service, db }
}
async function drain(it: AsyncIterable<StreamEvent>) { const out: StreamEvent[] = []; for await (const e of it) out.push(e); return out }
const text = (events: StreamEvent[]) => events.filter((e) => e.event === "token").map((e) => (e.data as { text: string }).text).join("")

test("75-day question: 3 windows, exact consolidated total, done.partial reflects truncation", async () => {
    const windows: string[] = []
    const rows = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: i, valor_pago: 10 })))
    const primary = new ScriptedModel({ name: "principal", script: [call("financeiro_contas_pagas_periodo", { data_inicial: "2026-01-01", data_final: "2026-03-16" }), new AIMessage("Foram 90 pagamentos somando R$ 900,00.")] })
    const { service } = build({ primary, paid: async (a) => { windows.push(`${a.data_inicial}..${a.data_final}`); return rows(30) } })
    const events = await drain(service.start({ message: "contas pagas de janeiro a meados de março" }).events)
    assert.deepEqual(windows, ["2026-01-01..2026-01-30", "2026-01-31..2026-03-01", "2026-03-02..2026-03-16"])
    assert.match(text(events), /900,00/)
    const done = events.at(-1)!
    assert.ok(done.event === "done" && done.data.partial === true, "90 rows > 40 → partial")
})

test("primary down → reserve answers and done.model is the reserve", async () => {
    const primary = new ScriptedModel({ name: "principal", script: [], failTimes: 99, failWith: Object.assign(new Error("503"), { status: 503 }) })
    const fallback = new ScriptedModel({ name: "reserva", script: [new AIMessage("resposta da reserva")] })
    const { service, db } = build({ primary, fallback, paid: async () => "[]" })
    const events = await drain(service.start({ message: "oi" }).events)
    assert.equal(text(events), "resposta da reserva")
    const done = events.at(-1)!
    assert.ok(done.event === "done" && done.data.model === "reserva")
    assert.equal((db.prepare("SELECT model_used FROM runs").get() as { model_used: string }).model_used, "reserva")
})

test("API 429 becomes an explanation for the user, not a crash", async () => {
    let attempts = 0
    const primary = new ScriptedModel({ name: "principal", script: [call("financeiro_contas_pagas_periodo", { data_inicial: "2026-01-01", data_final: "2026-01-10" }), new AIMessage("O limite da API foi atingido; tente em alguns segundos.")] })
    const { service } = build({ primary, paid: async () => { attempts++; throw new Error("HTTP 429: usage limit exceeded (Retry-After: 7s)") } })
    const events = await drain(service.start({ message: "contas pagas" }).events)
    assert.ok(attempts >= 3)
    assert.match(text(events), /limite/)
    assert.equal(events.at(-1)!.event, "done")
})
