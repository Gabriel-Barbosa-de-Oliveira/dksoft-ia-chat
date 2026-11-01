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

test("trustProxy defaults to false and accepts only true/false", () => {
    assert.equal(loadConfig(base).trustProxy, false)
    assert.equal(loadConfig({ ...base, TRUST_PROXY: "true" }).trustProxy, true)
    assert.throws(() => loadConfig({ ...base, TRUST_PROXY: "yes" }), /TRUST_PROXY/)
})

test("artifact settings default to the plan values", () => {
    const c = loadConfig(base)
    assert.equal(c.artifactsEnabled, true)
    assert.equal(c.resultTtlMs, 3600000)
    assert.equal(c.resultMaxRows, 20000)
    assert.equal(c.resultStoreMaxMb, 64)
    assert.equal(c.exportTtlMs, 1800000)
    assert.equal(c.exportMaxRows, 5000)
    assert.equal(c.exportTimeoutMs, 30000)
    assert.equal(c.exportMaxConcurrency, 2)
    assert.equal(c.fileStoreMaxMb, 96)
    assert.equal(c.exportRateLimitPerMin, 20)
})

test("ARTIFACTS_ENABLED=false is recognised and other values are rejected", () => {
    assert.equal(loadConfig({ ...base, ARTIFACTS_ENABLED: "false" }).artifactsEnabled, false)
    assert.throws(() => loadConfig({ ...base, ARTIFACTS_ENABLED: "no" }), /ARTIFACTS_ENABLED/)
})

test("artifact limits reject invalid values without echoing secrets", () => {
    assert.throws(() => loadConfig({ ...base, EXPORT_MAX_ROWS: "0" }), /EXPORT_MAX_ROWS/)
    assert.throws(() => loadConfig({ ...base, EXPORT_TTL_MS: "abc" }), (e: Error) => /EXPORT_TTL_MS/.test(e.message) && !e.message.includes(base.API_TOKEN + base.API_TOKEN))
    assert.equal(loadConfig({ ...base, EXPORT_MAX_ROWS: "100" }).exportMaxRows, 100)
})
