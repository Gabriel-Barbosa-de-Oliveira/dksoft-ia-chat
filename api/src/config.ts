import { z } from "zod"

const int = (min: number, max?: number) => {
    let s = z.coerce.number().int().min(min)
    if (max !== undefined) s = s.max(max)
    return s
}

const EnvSchema = z.object({
    OPENROUTER_API_KEY: z.string().min(1),
    OPENROUTER_MODEL: z.string().min(1),
    OPENROUTER_MODEL_FALLBACK: z.string().optional().default(""),
    API_TOKEN: z.string().min(1),
    BASE_URL: z.string().url().refine((u) => u.replace(/\/+$/, "").endsWith("/api/v1"), "BASE_URL deve terminar em /api/v1"),
    CHAT_ACCESS_KEY: z.string().min(32, "CHAT_ACCESS_KEY precisa ter pelo menos 32 caracteres"),
    CHAT_CORS_ORIGINS: z.string().default("http://localhost:5173"),
    CHAT_DB: z.string().default("./data/chat.db"),
    PORT: int(0, 65535).default(3000),
    CHAT_TIMEOUT_MS: int(1).default(120000),
    CHAT_HISTORY_LIMIT: int(1).default(12),
    DKSOFT_MAX_CONCURRENCY: int(1, 5).default(4),
    DKSOFT_MAX_PER_MINUTE: int(1, 60).default(50),
    TOOL_RESULT_MAX_ROWS: int(1).default(40),
    CHAT_RATE_LIMIT_PER_MIN: int(1).default(30),
    MCP_ENTRY: z.string().default("../mcp/src/index.ts"),
    TRUST_PROXY: z.enum(["true", "false"]).default("false"),
    ARTIFACTS_ENABLED: z.enum(["true", "false"]).default("true"),
    RESULT_TTL_MS: int(1).default(3600000),
    RESULT_MAX_ROWS: int(1).default(20000),
    RESULT_STORE_MAX_MB: int(1).default(64),
    EXPORT_TTL_MS: int(1).default(1800000),
    EXPORT_MAX_ROWS: int(1).default(5000),
    EXPORT_TIMEOUT_MS: int(1).default(30000),
    EXPORT_MAX_CONCURRENCY: int(1).default(2),
    FILE_STORE_MAX_MB: int(1).default(96),
    EXPORT_RATE_LIMIT_PER_MIN: int(1).default(20),
})

export type AppConfig = {
    openrouterApiKey: string
    model: string
    fallbackModel: string | undefined
    apiToken: string
    baseUrl: string
    accessKey: string
    corsOrigins: string[]
    dbPath: string
    port: number
    timeoutMs: number
    historyLimit: number
    maxConcurrency: number
    maxPerMinute: number
    toolResultMaxRows: number
    chatRateLimitPerMin: number
    mcpEntry: string
    trustProxy: boolean
    artifactsEnabled: boolean
    resultTtlMs: number
    resultMaxRows: number
    resultStoreMaxMb: number
    exportTtlMs: number
    exportMaxRows: number
    exportTimeoutMs: number
    exportMaxConcurrency: number
    fileStoreMaxMb: number
    exportRateLimitPerMin: number
}

// pure: validates the environment and never echoes secret values in errors
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
    const parsed = EnvSchema.safeParse(env)
    if (!parsed.success) {
        const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
        throw new Error(`Configuração inválida: ${problems}`)
    }
    const e = parsed.data
    const fallback = e.OPENROUTER_MODEL_FALLBACK.trim()
    return {
        openrouterApiKey: e.OPENROUTER_API_KEY,
        model: e.OPENROUTER_MODEL,
        fallbackModel: fallback === "" || fallback === e.OPENROUTER_MODEL ? undefined : fallback,
        apiToken: e.API_TOKEN,
        baseUrl: e.BASE_URL.replace(/\/+$/, ""),
        accessKey: e.CHAT_ACCESS_KEY,
        corsOrigins: e.CHAT_CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
        dbPath: e.CHAT_DB,
        port: e.PORT,
        timeoutMs: e.CHAT_TIMEOUT_MS,
        historyLimit: e.CHAT_HISTORY_LIMIT,
        maxConcurrency: e.DKSOFT_MAX_CONCURRENCY,
        maxPerMinute: e.DKSOFT_MAX_PER_MINUTE,
        toolResultMaxRows: e.TOOL_RESULT_MAX_ROWS,
        chatRateLimitPerMin: e.CHAT_RATE_LIMIT_PER_MIN,
        mcpEntry: e.MCP_ENTRY,
        trustProxy: e.TRUST_PROXY === "true",
        artifactsEnabled: e.ARTIFACTS_ENABLED === "true",
        resultTtlMs: e.RESULT_TTL_MS,
        resultMaxRows: e.RESULT_MAX_ROWS,
        resultStoreMaxMb: e.RESULT_STORE_MAX_MB,
        exportTtlMs: e.EXPORT_TTL_MS,
        exportMaxRows: e.EXPORT_MAX_ROWS,
        exportTimeoutMs: e.EXPORT_TIMEOUT_MS,
        exportMaxConcurrency: e.EXPORT_MAX_CONCURRENCY,
        fileStoreMaxMb: e.FILE_STORE_MAX_MB,
        exportRateLimitPerMin: e.EXPORT_RATE_LIMIT_PER_MIN,
    }
}
