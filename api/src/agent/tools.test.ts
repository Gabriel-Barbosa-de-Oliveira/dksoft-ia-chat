import assert from "node:assert/strict"
import { test } from "node:test"
import { tool } from "langchain"
import { z } from "zod"
import { createLimiter } from "../services/limiter.ts"
import { buildMcpServers, composeTools, loadTools, TOOL_ALLOWLIST } from "./tools.ts"

test("child env has only BASE_URL, API_TOKEN and PATH", () => {
    const s = buildMcpServers({ mcpEntry: "../mcp/src/index.ts", baseUrl: "https://x/api/v1", apiToken: "tok" })
    assert.deepEqual(Object.keys(s.dksoft.env).sort(), ["API_TOKEN", "BASE_URL", "PATH"])
    assert.equal(s.dksoft.env.API_TOKEN, "tok")
    assert.ok(s.dksoft.args.includes("../mcp/src/index.ts"))
})

test("tools outside the allowlist are dropped", async () => {
    const adapter = { listTools: async () => [{ name: "dksoft_list_students" }, { name: "dksoft_delete_student" }, { name: "other_tool" }] as never }
    const tools = await loadTools(adapter as never)
    assert.deepEqual(tools.map((t) => t.name), ["dksoft_list_students"])
})

test("allowlist is read-only only", () => {
    for (const n of TOOL_ALLOWLIST) assert.match(n, /^dksoft_(list|find)_/)
})

function fakeMcp(calls: { name: string; args: Record<string, unknown> }[]) {
    const mk = (name: string, valor: number) => tool(async (args: Record<string, unknown>) => {
        calls.push({ name, args })
        return JSON.stringify([{ id: args.data_inicial, valor_pago: valor }])
    }, { name, description: "x", schema: z.object({ data_inicial: z.string(), data_final: z.string(), aluno: z.string().optional(), pacote: z.string().optional() }) })
    return [mk("dksoft_list_paid_bills", 10), mk("dksoft_list_receivable_accounts", 5), mk("dksoft_list_students", 1)]
}

test("financial MCP tools are replaced by period tools", () => {
    const names = composeTools(fakeMcp([]) as never, createLimiter({ maxConcurrent: 4, perMinute: 100 })).map((t) => t.name).sort()
    assert.deepEqual(names, ["dksoft_list_students", "financeiro_contas_pagas_periodo", "financeiro_contas_recebidas_periodo"])
})

test("75 days → 3 sequential calls with the right windows and a consolidated result", async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = []
    const tools = composeTools(fakeMcp(calls) as never, createLimiter({ maxConcurrent: 1, perMinute: 100 }))
    const t = tools.find((x) => x.name === "financeiro_contas_pagas_periodo")!
    const out = JSON.parse(String(await t.invoke({ data_inicial: "2026-01-01", data_final: "2026-03-16", aluno: "Ana" })))
    assert.equal(out.length, 3)
    assert.deepEqual(calls.map((c) => [c.args.data_inicial, c.args.data_final]), [["2026-01-01", "2026-01-30"], ["2026-01-31", "2026-03-01"], ["2026-03-02", "2026-03-16"]])
    assert.ok(calls.every((c) => c.args.aluno === "Ana" && c.name === "dksoft_list_paid_bills"))
})

test("91 days → no call and a clear message", async () => {
    const calls: { name: string; args: Record<string, unknown> }[] = []
    const t = composeTools(fakeMcp(calls) as never, createLimiter({ maxConcurrent: 4, perMinute: 100 })).find((x) => x.name === "financeiro_contas_recebidas_periodo")!
    const msg = String(await t.invoke({ data_inicial: "2026-01-01", data_final: "2026-04-01" }))
    assert.match(msg, /90 dias/)
    assert.equal(calls.length, 0)
})
