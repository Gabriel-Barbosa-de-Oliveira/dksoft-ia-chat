import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { MAX_RECEIVABLE_PERIOD_DAYS, validateReceivablePeriod } from "../../domain/receivableAccount.ts";

// prompt arguments are always strings in MCP
const FindReceivableAccountsArgsSchema = z.object({
    data_inicial: z.string().describe("Start date of the period (YYYY-MM-DD)"),
    data_final: z.string().describe("End date of the period (YYYY-MM-DD), max. 30 days after data_inicial"),
    aluno: z.string().optional().describe("Name (or part of the name) of the student"),
    pacote: z.string().optional().describe("Name (or part of the name) of the package"),
})

export function registerFindReceivableAccountsPrompt(server: McpServer) {
    server.registerPrompt(
        "find_receivable_accounts_prompt",
        {
            description: "Prompt to search for received accounts in a period (max. 30 days), optionally filtered by student or package",
            argsSchema: FindReceivableAccountsArgsSchema.shape
        },
        (query) => {
            const periodError = validateReceivablePeriod(query.data_inicial, query.data_final)
            if (periodError) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Do not call any tool. Tell the user the following and ask for a new period of at most ${MAX_RECEIVABLE_PERIOD_DAYS} days:\n${periodError}`,
                            }
                        }
                    ]
                }
            }

            return {
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: `Please find the received accounts between data_inicial and data_final using the list_receivable_accounts tool, passing aluno and/or pacote as filters when they are provided.\nQuery: ${JSON.stringify(query)}`,
                        }
                    }
                ]
            }
        }
    )
}
