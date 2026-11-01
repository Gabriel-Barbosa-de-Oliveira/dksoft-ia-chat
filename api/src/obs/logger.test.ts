import assert from "node:assert/strict"
import { test } from "node:test"
import Fastify from "fastify"
import { buildLoggerOptions, safeLog } from "./logger.ts"

test("redacts authorization, hides body and masks pii", async () => {
    const lines: string[] = []
    const app = Fastify({ logger: buildLoggerOptions({ write: (c) => void lines.push(c) }) })
    app.post("/x", async (req) => {
        safeLog(req.log, "info", "falha em /alunos/cpf/12345678909 de a@b.com")
        return { ok: true }
    })
    await app.inject({ method: "POST", url: "/x?cpf=12345678909", headers: { authorization: "Bearer SEGREDO" }, payload: { cpf: "98765432100" } })
    await app.close()
    const all = lines.join("")
    for (const forbidden of ["SEGREDO", "12345678909", "98765432100", "a@b.com"]) assert.ok(!all.includes(forbidden), forbidden)
    assert.ok(all.includes("falha em"))
})

import { maskFileId } from "./logger.ts"

test("the download path never reaches the logs with its file id", () => {
    const id = "22222222-2222-4222-8222-222222222222"
    assert.equal(maskFileId(`/conversations/abc/exports/${id}`), "/conversations/abc/exports/:fileId")
    assert.equal(maskFileId(`/conversations/abc/exports/${id}?x=1`), "/conversations/abc/exports/:fileId?x=1")
    assert.equal(maskFileId("/health"), "/health")
})
