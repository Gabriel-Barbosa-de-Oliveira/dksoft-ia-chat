import assert from "node:assert/strict"
import { test } from "node:test"
import type { AgentEvent, AgentInput, AgentRunner } from "../domain/agent-port.ts"
import { ChatTimeoutError, ConversationNotFoundError, ModelUnavailableError, ToolsUnavailableError } from "../domain/errors.ts"
import type { StreamEvent } from "../domain/events.ts"
import { openDatabase } from "../store/db.ts"
import { createSqliteConversationStore } from "../store/sqlite-conversation-store.ts"
import { createSqliteRunStore } from "../store/sqlite-run-store.ts"
import { createChatService } from "./chat.service.ts"
import { createConversationLock } from "./conversation-lock.ts"

type Script = (input: AgentInput) => AsyncGenerator<AgentEvent>
const agentOf = (script: Script, seen: AgentInput[] = []): AgentRunner => ({ run: (input) => { seen.push(input); return script(input) } })
const answer = (text: string): Script => async function* () {
    yield { type: "tool", phase: "start", name: "dksoft_list_students" }
    yield { type: "tool", phase: "end", name: "dksoft_list_students", ok: true }
    for (const t of text.split(/(?<= )/)) yield { type: "token", text: t }
    yield { type: "end", model: "m1", partial: false, toolCalls: 1 }
}

function setup(script: Script, opts: { timeoutMs?: number; historyLimit?: number; seen?: AgentInput[] } = {}) {
    const db = openDatabase(":memory:")
    const conversations = createSqliteConversationStore(db)
    const service = createChatService({
        agent: agentOf(script, opts.seen), conversations, runs: createSqliteRunStore(db), lock: createConversationLock(),
        historyLimit: opts.historyLimit ?? 12, timeoutMs: opts.timeoutMs ?? 5000,
    })
    return { db, conversations, service }
}
async function drain(it: AsyncIterable<StreamEvent>) { const out: StreamEvent[] = []; for await (const e of it) out.push(e); return out }
const runs = (db: ReturnType<typeof openDatabase>) => db.prepare("SELECT * FROM runs").all() as Record<string, unknown>[]

test("happy path: meta → tool → tokens → done; pair and run are saved", async () => {
    const { db, conversations, service } = setup(answer("Há 1 aluno."))
    const s = service.start({ message: "quantos?" })
    const events = await drain(s.events)
    assert.deepEqual(events.map((e) => e.event), ["meta", "tool", "tool", "token", "token", "token", "done"])
    assert.equal(events[0]!.event === "meta" && events[0]!.data.conversationId, s.conversationId)
    assert.deepEqual(conversations.listMessages(s.conversationId).map((m) => m.content), ["quantos?", "Há 1 aluno."])
    const [run] = runs(db)
    assert.equal(run!.outcome, "ok"); assert.equal(run!.model_used, "m1"); assert.equal(run!.tool_calls, 1)
    assert.ok(!JSON.stringify(run).includes("quantos"))
})

test("second turn receives the first pair; conversation B is isolated; window is limited", async () => {
    const seen: AgentInput[] = []
    const { service } = setup(answer("ok"), { historyLimit: 3, seen })
    const a = service.start({ message: "q1" }); await drain(a.events)
    await drain(service.start({ message: "q2", conversationId: a.conversationId }).events)
    assert.deepEqual(seen[1]!.history.map((h) => h.content), ["q1", "ok"])
    await drain(service.start({ message: "q3", conversationId: a.conversationId }).events)
    assert.equal(seen[2]!.history.length, 3)
    await drain(service.start({ message: "outra" }).events)
    assert.deepEqual(seen[3]!.history, [])
})

test("unknown conversationId throws before streaming and creates nothing", () => {
    const { db, service } = setup(answer("x"))
    assert.throws(() => service.start({ message: "q", conversationId: "nope" }), ConversationNotFoundError)
    assert.equal((db.prepare("SELECT COUNT(*) c FROM conversations").get() as { c: number }).c, 0)
    assert.equal(runs(db).length, 0)
})

test("same-conversation turns are serialised", async () => {
    const order: string[] = []
    const script: Script = async function* (input) {
        order.push(`start ${input.message}`)
        await new Promise((r) => setTimeout(r, input.message === "a" ? 30 : 1))
        yield { type: "token", text: input.message }
        order.push(`end ${input.message}`)
        yield { type: "end", model: "m", partial: false, toolCalls: 0 }
    }
    const { service } = setup(script)
    const first = service.start({ message: "a" })
    const second = service.start({ message: "b", conversationId: first.conversationId })
    await Promise.all([drain(first.events), drain(second.events)])
    assert.deepEqual(order, ["start a", "end a", "start b", "end b"])
})

test("partial flag is forwarded", async () => {
    const { service } = setup(async function* () { yield { type: "token", text: "x" }; yield { type: "end", model: "m", partial: true, toolCalls: 1 } })
    const events = await drain(service.start({ message: "q" }).events)
    const done = events.at(-1)!
    assert.ok(done.event === "done" && done.data.partial)
})

test("timeout: hanging agent → ChatTimeoutError, run=timeout, nothing saved", async () => {
    const { db, conversations, service } = setup(async function* (input) {
        await new Promise((_, rej) => input.signal.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" }))))
        yield { type: "end", model: null, partial: false, toolCalls: 0 }
    }, { timeoutMs: 30 })
    const s = service.start({ message: "q" })
    await assert.rejects(drain(s.events), ChatTimeoutError)
    assert.equal(runs(db)[0]!.outcome, "timeout")
    assert.equal(conversations.listMessages(s.conversationId).length, 0)
})

test("client abort → run=aborted, no error thrown, nothing saved", async () => {
    const ctrl = new AbortController()
    const { db, conversations, service } = setup(async function* (input) {
        yield { type: "token", text: "a" }
        await new Promise((_, rej) => {
            const fail = () => rej(Object.assign(new Error("a"), { name: "AbortError" }))
            if (input.signal.aborted) fail(); else input.signal.addEventListener("abort", fail)
        })
    })
    const s = service.start({ message: "q", signal: ctrl.signal })
    const out: StreamEvent[] = []
    for await (const e of s.events) { out.push(e); if (e.event === "token") ctrl.abort() }
    assert.ok(!out.some((e) => e.event === "done" || e.event === "error"))
    assert.equal(runs(db)[0]!.outcome, "aborted")
    assert.equal(conversations.listMessages(s.conversationId).length, 0)
})

test("model and tool failures surface as the right domain errors", async () => {
    const fail = (err: unknown) => setup(async function* () { throw err; yield { type: "end", model: null, partial: false, toolCalls: 0 } })
    for (const [raw, cls] of [
        [Object.assign(new Error("503"), { status: 503 }), ModelUnavailableError],
        [Object.assign(new Error("HTTP 429"), { name: "ToolException" }), ToolsUnavailableError],
    ] as const) {
        const { db, conversations, service } = fail(raw)
        const s = service.start({ message: "q" })
        await assert.rejects(drain(s.events), cls)
        assert.equal(runs(db)[0]!.outcome, "error")
        assert.equal(conversations.listMessages(s.conversationId).length, 0)
    }
})

test("unknown failure is propagated and recorded as error", async () => {
    const { db, service } = setup(async function* () { throw new Error("bug"); yield { type: "end", model: null, partial: false, toolCalls: 0 } })
    await assert.rejects(drain(service.start({ message: "q" }).events), /bug/)
    assert.equal(runs(db)[0]!.error_type, "Error")
})
