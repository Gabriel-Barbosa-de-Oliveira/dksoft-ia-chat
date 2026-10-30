import assert from "node:assert/strict"
import { test } from "node:test"
import { buildMcpServers, loadTools, TOOL_ALLOWLIST } from "./tools.ts"

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
