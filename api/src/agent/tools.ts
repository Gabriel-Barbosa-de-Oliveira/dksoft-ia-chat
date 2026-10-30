import { MCPAdapter } from "@langchain/mcp-adapters"
import type { StructuredToolInterface } from "@langchain/core/tools"
import { tool } from "langchain"
import { z } from "zod"
import type { AppConfig } from "../config.ts"
import { InvalidPeriodError, PeriodTooLongError } from "../domain/errors.ts"
import { splitPeriod } from "../domain/period.ts"
import type { Limiter } from "../services/limiter.ts"

// read-only allowlist: anything else the MCP server exposes is discarded
export const TOOL_ALLOWLIST: readonly string[] = [
    "dksoft_list_packages",
    "dksoft_find_student",
    "dksoft_find_students_by_phone",
    "dksoft_list_students",
    "dksoft_list_student_courses",
    "dksoft_list_student_open_installments",
    "dksoft_list_student_attendance",
    "dksoft_list_student_exams",
    "dksoft_list_paid_bills",
    "dksoft_list_receivable_accounts",
]

// the only place where the DKSOFT token enters: the env of the MCP child process
export function buildMcpServers(config: Pick<AppConfig, "mcpEntry" | "baseUrl" | "apiToken">) {
    return {
        dksoft: {
            transport: "stdio" as const,
            command: process.execPath,
            args: ["--experimental-strip-types", "--no-warnings", config.mcpEntry],
            env: { BASE_URL: config.baseUrl, API_TOKEN: config.apiToken, PATH: process.env.PATH ?? "" },
        },
    }
}

export async function loadTools(adapter: Pick<MCPAdapter, "listTools">): Promise<StructuredToolInterface[]> {
    const all = (await adapter.listTools()) as StructuredToolInterface[]
    return all.filter((t) => TOOL_ALLOWLIST.includes(t.name))
}

const PAID = "dksoft_list_paid_bills"
const RECEIVABLE = "dksoft_list_receivable_accounts"

// MCP adapters may return a string, content blocks, or a [content, artifact] tuple
function resultToText(r: unknown): string {
    if (typeof r === "string") return r
    if (Array.isArray(r)) {
        if (r.length === 2 && Array.isArray(r[1]) === false && typeof r[1] === "object" && (typeof r[0] === "string" || Array.isArray(r[0]))) return resultToText(r[0])
        return r.map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : typeof b === "string" ? b : "")).join("")
    }
    return JSON.stringify(r)
}

function rowsOf(raw: unknown): unknown[] {
    const text = resultToText(raw)
    let json: unknown
    try { json = JSON.parse(text) } catch { throw new Error(text) }
    if (Array.isArray(json)) return json
    if (json && typeof json === "object") {
        const arrays = Object.values(json).filter(Array.isArray)
        if (arrays.length === 1) return arrays[0] as unknown[]
    }
    throw new Error("Resposta inesperada da consulta financeira")
}

const PeriodInput = z.object({
    data_inicial: z.string().describe("Data inicial (AAAA-MM-DD)"),
    data_final: z.string().describe("Data final (AAAA-MM-DD). O período total pode ter até 90 dias"),
    aluno: z.string().optional().describe("Nome (ou parte do nome) do aluno"),
    pacote: z.string().optional().describe("Nome (ou parte do nome) do pacote"),
})

type Invokable = { invoke(input: Record<string, unknown>): Promise<unknown> }

function periodTool(name: string, description: string, inner: Invokable, limiter: Limiter) {
    return tool(
        async (input) => {
            let windows
            try {
                windows = splitPeriod(input.data_inicial, input.data_final)
            } catch (err) {
                if (err instanceof PeriodTooLongError || err instanceof InvalidPeriodError) return `${err.message}. Peça à pessoa um período menor ou válido.`
                throw err
            }
            const all: unknown[] = []
            for (const w of windows) {
                // one limiter slot per HTTP request (the limiter middleware exempts these tools)
                const raw = await limiter.run(() => inner.invoke({ data_inicial: w.inicio, data_final: w.fim, ...(input.aluno ? { aluno: input.aluno } : {}), ...(input.pacote ? { pacote: input.pacote } : {}) }))
                all.push(...rowsOf(raw))
            }
            return JSON.stringify(all)
        },
        { name, description, schema: PeriodInput },
    )
}

// final tool set: the two 30-day financial MCP tools are replaced by period tools (up to 90 days, split in windows)
export function composeTools(mcpTools: StructuredToolInterface[], limiter: Limiter): StructuredToolInterface[] {
    const paid = mcpTools.find((t) => t.name === PAID)
    const receivable = mcpTools.find((t) => t.name === RECEIVABLE)
    const rest = mcpTools.filter((t) => t.name !== PAID && t.name !== RECEIVABLE)
    const extra: StructuredToolInterface[] = []
    if (paid) extra.push(periodTool("financeiro_contas_pagas_periodo", "Lista as contas pagas em um período de até 90 dias (a ferramenta divide em janelas de 30 dias). Devolve total e somas exatos.", paid as Invokable, limiter) as unknown as StructuredToolInterface)
    if (receivable) extra.push(periodTool("financeiro_contas_recebidas_periodo", "Lista as contas recebidas em um período de até 90 dias (a ferramenta divide em janelas de 30 dias). Devolve total e somas exatos.", receivable as Invokable, limiter) as unknown as StructuredToolInterface)
    return [...rest, ...extra]
}
