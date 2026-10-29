import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { MAX_PAID_BILLS_PERIOD_DAYS, validatePaidBillsPeriod } from "../../domain/paidBills.ts";

// prompt arguments are always strings in MCP
const FindPaidBillsArgsSchema = z.object({
    data_inicial: z.string().describe("Start date of the period (YYYY-MM-DD)"),
    data_final: z.string().describe("End date of the period (YYYY-MM-DD), max. 30 days after data_inicial"),
    aluno: z.string().optional().describe("Name (or part of the name) of the student"),
    pacote: z.string().optional().describe("Name (or part of the name) of the package"),
})

export function registerFindPaidBillsPrompt(server: McpServer) {
    server.registerPrompt(
        "find_paid_bills_prompt",
        {
            description: "Prompt to search for paid bills in a period (max. 30 days), optionally filtered by student or package",
            argsSchema: FindPaidBillsArgsSchema.shape
        },
        (query) => {
            const periodError = validatePaidBillsPeriod(query.data_inicial, query.data_final)
            if (periodError) {
                return {
                    messages: [
                        {
                            role: "user",
                            content: {
                                type: "text",
                                text: `Do not call any tool. Tell the user the following and ask for a new period of at most ${MAX_PAID_BILLS_PERIOD_DAYS} days:\n${periodError}`,
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
                            text: `Please find the paid bills between data_inicial and data_final using the list_paid_bills tool, passing aluno and/or pacote as filters when they are provided.\nQuery: ${JSON.stringify(query)}`,
                        }
                    }
                ]
            }
        }
    )
}
