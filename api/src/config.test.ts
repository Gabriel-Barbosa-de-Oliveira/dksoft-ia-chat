import assert from "node:assert/strict"
import { test } from "node:test"
import { loadConfig } from "./config.ts"

const base = {
    OPENROUTER_API_KEY: "k", OPENROUTER_MODEL: "m/a", API_TOKEN: "t",
    BASE_URL: "https://dkapi.dksoft.com.br/api/v1", CHAT_ACCESS_KEY: "x".repeat(32),
}

test("defaults", () => {
    const c = loadConfig(base)
    assert.equal(c.port, 3000)
    assert.equal(c.timeoutMs, 120000)
    assert.equal(c.maxConcurrency, 4)
    assert.deepEqual(c.corsOrigins, ["http://localhost:5173"])
    assert.equal(c.fallbackModel, undefined)
})

test("fallback equal to main means none; distinct is kept", () => {
    assert.equal(loadConfig({ ...base, OPENROUTER_MODEL_FALLBACK: "m/a" }).fallbackModel, undefined)
    assert.equal(loadConfig({ ...base, OPENROUTER_MODEL_FALLBACK: "m/b" }).fallbackModel, "m/b")
})

test("rejects bad values without echoing secrets", () => {
    assert.throws(() => loadConfig({ ...base, CHAT_ACCESS_KEY: "short-secret" }), (e: Error) => !e.message.includes("short-secret") && /CHAT_ACCESS_KEY/.test(e.message))
    assert.throws(() => loadConfig({ ...base, BASE_URL: "https://x.com/api" }), /BASE_URL/)
    assert.throws(() => loadConfig({ ...base, DKSOFT_MAX_CONCURRENCY: "6" }), /DKSOFT_MAX_CONCURRENCY/)
    assert.throws(() => loadConfig({ ...base, API_TOKEN: "" }), /API_TOKEN/)
})

test("cors origins parsed", () => {
    assert.deepEqual(loadConfig({ ...base, CHAT_CORS_ORIGINS: "http://a.com, http://b.com" }).corsOrigins, ["http://a.com", "http://b.com"])
})
