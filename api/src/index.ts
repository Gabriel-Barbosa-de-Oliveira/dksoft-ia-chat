import { MCPAdapter } from "@langchain/mcp-adapters"
import { loadConfig } from "./config.ts"
import { createApp } from "./http/app.ts"
import { createProductionAgent } from "./agent/agent.ts"
import { createChatModel } from "./agent/model.ts"
import { buildMcpServers, loadTools } from "./agent/tools.ts"
import { createLimiter } from "./services/limiter.ts"
import { createChatService } from "./services/chat.service.ts"
import { createConversationLock } from "./services/conversation-lock.ts"
import { openDatabase } from "./store/db.ts"
import { createSqliteConversationStore } from "./store/sqlite-conversation-store.ts"
import { createSqliteRunStore } from "./store/sqlite-run-store.ts"
import { randomUUID } from "node:crypto"
import { createArtifactToolBuilder } from "./agent/artifact-tools.ts"
import { createDocumentRenderer } from "./render/worker-pool.ts"
import { createChartService } from "./services/chart.service.ts"
import { createExportService } from "./services/export.service.ts"
import { createMemoryFileStore } from "./store/memory-file-store.ts"
import { createMemoryResultStore } from "./store/memory-result-store.ts"
import { createSqliteExportRunStore } from "./store/sqlite-export-run-store.ts"

// composition root: the only place that wires config, IO and services together
async function main() {
    const config = loadConfig(process.env)
    const db = openDatabase(config.dbPath)
    const adapter = new MCPAdapter({ servers: buildMcpServers(config) })

    let tools
    try {
        tools = await loadTools(adapter)
    } catch (err) {
        console.error("Não foi possível iniciar o servidor MCP (verifique MCP_ENTRY, BASE_URL e API_TOKEN):", err instanceof Error ? err.message : "erro desconhecido")
        process.exit(1)
    }
    if (tools.length === 0) {
        console.error("O servidor MCP não expôs nenhuma tool permitida.")
        process.exit(1)
    }

    const conversations = createSqliteConversationStore(db)

    // spec 004: results, charts and files live in memory only; ARTIFACTS_ENABLED=false restores the MVP behaviour
    let artifactsForAgent
    let artifactsForHttp
    let renderer: ReturnType<typeof createDocumentRenderer> | undefined
    let sweeper: ReturnType<typeof setInterval> | undefined
    if (config.artifactsEnabled) {
        const results = createMemoryResultStore({ ttlMs: config.resultTtlMs, maxRows: config.resultMaxRows, maxBytes: config.resultStoreMaxMb * 1024 * 1024 })
        const files = createMemoryFileStore({ maxBytes: config.fileStoreMaxMb * 1024 * 1024 })
        const runs = createSqliteExportRunStore(db)
        renderer = createDocumentRenderer({ timeoutMs: config.exportTimeoutMs, maxConcurrency: config.exportMaxConcurrency })
        const exports = createExportService({ results, files, renderer, runs, config: { exportMaxRows: config.exportMaxRows, exportTtlMs: config.exportTtlMs } })
        const charts = createChartService({ results, runs })
        artifactsForAgent = { buildTools: createArtifactToolBuilder({ results, exports, charts }), results, newId: randomUUID }
        artifactsForHttp = { exports, files, rateLimitPerMin: config.exportRateLimitPerMin }
        sweeper = setInterval(() => { results.sweep(); files.sweep() }, 60_000)
        sweeper.unref()
    }

    const agent = createProductionAgent({
        model: createChatModel(config.model, config.openrouterApiKey),
        modelName: config.model,
        fallbackModel: config.fallbackModel ? createChatModel(config.fallbackModel, config.openrouterApiKey) : undefined,
        mcpTools: tools,
        limiter: createLimiter({ maxConcurrent: config.maxConcurrency, perMinute: config.maxPerMinute }),
        limits: { maxRows: config.toolResultMaxRows, maxChars: 24000 },
        ...(artifactsForAgent ? { artifacts: artifactsForAgent } : {}),
    })
    const chat = createChatService({
        agent, conversations, runs: createSqliteRunStore(db), lock: createConversationLock(),
        historyLimit: config.historyLimit, timeoutMs: config.timeoutMs,
    })
    const app = await createApp({
        chat, conversations, accessKey: config.accessKey, corsOrigins: config.corsOrigins, chatRateLimitPerMin: config.chatRateLimitPerMin,
        trustProxy: config.trustProxy,
        ...(artifactsForHttp ? { artifacts: artifactsForHttp } : {}),
    })

    const shutdown = async () => {
        if (sweeper) clearInterval(sweeper)
        await app.close()
        await renderer?.close?.()
        await adapter.close?.()
        db.close()
        process.exit(0)
    }
    process.on("SIGINT", shutdown)
    process.on("SIGTERM", shutdown)

    await app.listen({ port: config.port, host: "0.0.0.0" })
}

main().catch((err) => {
    console.error("Falha ao iniciar:", err instanceof Error ? err.message : "erro desconhecido")
    process.exit(1)
})
