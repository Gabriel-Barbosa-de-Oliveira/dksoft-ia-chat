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
    const agent = createProductionAgent({
        model: createChatModel(config.model, config.openrouterApiKey),
        modelName: config.model,
        fallbackModel: config.fallbackModel ? createChatModel(config.fallbackModel, config.openrouterApiKey) : undefined,
        mcpTools: tools,
        limiter: createLimiter({ maxConcurrent: config.maxConcurrency, perMinute: config.maxPerMinute }),
        limits: { maxRows: config.toolResultMaxRows, maxChars: 24000 },
    })
    const chat = createChatService({
        agent, conversations, runs: createSqliteRunStore(db), lock: createConversationLock(),
        historyLimit: config.historyLimit, timeoutMs: config.timeoutMs,
    })
    const app = await createApp({
        chat, conversations, accessKey: config.accessKey, corsOrigins: config.corsOrigins, chatRateLimitPerMin: config.chatRateLimitPerMin,
    })

    const shutdown = async () => {
        await app.close()
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
