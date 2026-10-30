import assert from "node:assert/strict"
import { test } from "node:test"
import { auth, buildTestApp, ORIGIN, readSse, simpleAgent } from "../test-app.ts"

const post = (base: string, body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/chat`, { method: "POST", headers: { "content-type": "application/json", ...auth, ...headers }, body: JSON.stringify(body) })

test("SSE order meta → tool → token… → done, with headers", async () => {
    const t = await buildTestApp()
    const base = await t.listen()
    const res = await post(base, { message: "quantos alunos?" })
    assert.equal(res.status, 200)
    assert.match(res.headers.get("content-type")!, /text\/event-stream/)
    assert.match(res.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/)
    const events = await readSse(res)
    assert.deepEqual(events.map((e) => e.event), ["meta", "tool", "tool", "token", "token", "token", "done"])
    assert.equal(events[0]!.data.requestId, res.headers.get("x-request-id"))
    assert.equal(events[0]!.data.conversationId, res.headers.get("x-conversation-id"))
    assert.equal(events.at(-1)!.data.model, "fake/model")
    await t.app.close()
})

test("first token arrives before the stream ends", async () => {
    const t = await buildTestApp({
        agent: async function* () {
            yield { type: "token", text: "primeiro " }
            await new Promise((r) => setTimeout(r, 150))
            yield { type: "token", text: "fim" }
            yield { type: "end", model: "m", partial: false, toolCalls: 0 }
        },
    })
    const base = await t.listen()
    const res = await post(base, { message: "oi" })
    const reader = res.body!.getReader()
    const t0 = Date.now()
    let seen = ""
    while (!seen.includes("primeiro")) seen += new TextDecoder().decode((await reader.read()).value)
    assert.ok(Date.now() - t0 < 120, "token delivered before the agent finished")
    await reader.cancel()
    await t.app.close()
})

test("invalid bodies → 400 without calling the agent", async () => {
    let calls = 0
    const t = await buildTestApp({ agent: async function* () { calls++; yield { type: "end", model: null, partial: false, toolCalls: 0 } } })
    const base = await t.listen()
    for (const body of [{}, { message: "" }, { message: "   " }, { message: "x".repeat(4001) }, { message: "oi", conversationId: "nao-uuid" }]) {
        const res = await post(base, body)
        assert.equal(res.status, 400, JSON.stringify(body).slice(0, 40))
        assert.equal((await res.json()).error, "invalid_body")
    }
    assert.equal(calls, 0)
    await t.app.close()
})

test("allowed origin gets CORS headers on the SSE response", async () => {
    const t = await buildTestApp()
    const base = await t.listen()
    const res = await post(base, { message: "oi" }, { origin: ORIGIN })
    assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN)
    assert.match(res.headers.get("access-control-expose-headers") ?? "", /X-Conversation-Id/i)
    await res.text()
    await t.app.close()
})

test("failure after the 200 becomes a single terminal error event", async () => {
    const t = await buildTestApp({ agent: async function* () { yield { type: "token", text: "a" }; throw Object.assign(new Error("raw provider text sk-123"), { status: 503 }) } })
    const base = await t.listen()
    const events = await readSse(await post(base, { message: "oi" }))
    const last = events.at(-1)!
    assert.equal(last.event, "error")
    assert.equal(last.data.code, "model_unavailable")
    assert.ok(!JSON.stringify(last).includes("sk-123"))
    assert.equal(events.filter((e) => e.event === "done" || e.event === "error").length, 1)
    await t.app.close()
})

test("closing the connection aborts the run and records it", async () => {
    let aborted = false
    const t = await buildTestApp({
        agent: async function* (input) {
            yield { type: "token", text: "a" }
            await new Promise<void>((resolve) => { input.signal.addEventListener("abort", () => { aborted = true; resolve() }) })
            throw Object.assign(new Error("a"), { name: "AbortError" })
        },
    })
    const base = await t.listen()
    const res = await post(base, { message: "oi" })
    const reader = res.body!.getReader()
    await reader.read()
    await reader.cancel()
    for (let i = 0; i < 50 && !aborted; i++) await new Promise((r) => setTimeout(r, 20))
    assert.ok(aborted)
    await new Promise((r) => setTimeout(r, 50))
    const rows = t.db.prepare("SELECT outcome FROM runs").all() as { outcome: string }[]
    assert.deepEqual(rows.map((r) => r.outcome), ["aborted"])
    await t.app.close()
})

test("unknown conversationId → 404 JSON, no stream, no run, no new conversation", async () => {
    const t = await buildTestApp()
    const base = await t.listen()
    const res = await post(base, { message: "oi", conversationId: "11111111-1111-4111-8111-111111111111" })
    assert.equal(res.status, 404)
    assert.equal((await res.json()).error, "conversation_not_found")
    assert.equal((t.db.prepare("SELECT COUNT(*) c FROM runs").get() as { c: number }).c, 0)
    assert.equal((t.db.prepare("SELECT COUNT(*) c FROM conversations").get() as { c: number }).c, 0)
    await t.app.close()
})

test("two simultaneous questions in one conversation are queued; history keeps order", async () => {
    const order: string[] = []
    const t = await buildTestApp({
        agent: async function* (input) {
            order.push(`start ${input.message}`)
            await new Promise((r) => setTimeout(r, input.message === "a" ? 80 : 1))
            yield { type: "token", text: `r-${input.message}` }
            order.push(`end ${input.message}`)
            yield { type: "end", model: "m", partial: false, toolCalls: 0 }
        },
    })
    const base = await t.listen()
    const first = await post(base, { message: "a" })
    const conversationId = first.headers.get("x-conversation-id")!
    const second = post(base, { message: "b", conversationId })
    await Promise.all([first.text(), second.then((r) => r.text())])
    assert.deepEqual(order, ["start a", "end a", "start b", "end b"])
    assert.deepEqual(t.conversations.listMessages(conversationId).map((m) => m.content), ["a", "r-a", "b", "r-b"])
    await t.app.close()
})

test("simpleAgent export is usable", () => assert.equal(typeof simpleAgent(), "function"))
