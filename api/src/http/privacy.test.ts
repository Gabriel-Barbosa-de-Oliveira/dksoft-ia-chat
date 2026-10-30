import assert from "node:assert/strict"
import { test } from "node:test"
import { auth, buildTestApp, readSse, ACCESS_KEY } from "./test-app.ts"

const SECRETS = ["tok-dksoft-secret", "sk-or-openrouter-secret", ACCESS_KEY]
const PII = ["123.456.789-09", "12345678909", "fulano@escola.com.br", "(11) 91234-5678", "11912345678"]

test("no secret or PII reaches logs, runs or error events", async () => {
    const lines: string[] = []
    const t = await buildTestApp({
        logSink: { write: (c) => void lines.push(c) },
        agent: async function* () {
            yield { type: "token", text: "parcial" }
            throw Object.assign(new Error("GET /alunos/cpf/12345678909 falhou para fulano@escola.com.br tel 11912345678"), { name: "ToolException" })
        },
    })
    const base = await t.listen()
    const res = await fetch(`${base}/chat?cpf=12345678909`, {
        method: "POST", headers: { "content-type": "application/json", ...auth },
        body: JSON.stringify({ message: "dados do aluno CPF 123.456.789-09, e-mail fulano@escola.com.br, tel (11) 91234-5678" }),
    })
    const events = await readSse(res)
    await t.app.close()

    const logs = lines.join("")
    const runs = JSON.stringify(t.db.prepare("SELECT * FROM runs").all())
    const sseErrors = JSON.stringify(events.filter((e) => e.event === "error"))
    assert.equal(events.at(-1)!.event, "error")
    for (const [name, text] of [["logs", logs], ["runs", runs], ["error events", sseErrors]] as const) {
        for (const s of [...SECRETS, ...PII]) assert.ok(!text.includes(s), `${name} contains ${s}`)
    }
    assert.ok(logs.length > 0)
    // the conversation history keeps the text by design (context), but only because the run succeeded: here it did not
    assert.equal((t.db.prepare("SELECT COUNT(*) c FROM messages").get() as { c: number }).c, 0)
})
