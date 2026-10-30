import { MCPAdapter } from "@langchain/mcp-adapters"
import type { StructuredToolInterface } from "@langchain/core/tools"
import type { AppConfig } from "../config.ts"

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
