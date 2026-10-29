import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { ReceivableAccountService } from "../../../application/receivableAccountService.ts";
import {
    ReceivableAccountFilterSchema,
    ReceivableAccountSchema,
    filterReceivableAccounts,
    validateReceivablePeriod,
} from "../../../domain/receivableAccount.ts";



export function registerListReceivableAccountsTool(
    server: McpServer,
    service: ReceivableAccountService
) {

    server.registerTool(
        "list_receivable_accounts",
        {
            description: "List the received accounts paid between data_inicial and data_final (max. 30 days), optionally filtered by student (aluno) and/or package (pacote)",
            inputSchema: ReceivableAccountFilterSchema.shape,
            outputSchema: {
                total: z.number().describe('Total of received accounts returned'),
                receivableAccounts: z.array(
                    ReceivableAccountSchema
                ).describe('Array of received accounts in the period')
            }
        },
        async ({ data_inicial, data_final, aluno, pacote }) => {
            const periodError = validateReceivablePeriod(data_inicial, data_final)
            if (periodError) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: periodError,
                        },
                    ],
                };
            }

            try {
                const { registros } = await service.listReceivableAccounts({ data_inicial, data_final })
                const receivableAccounts = filterReceivableAccounts(registros, { aluno, pacote })
                const total = receivableAccounts.length
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(receivableAccounts, null, 2)
                        }
                    ],
                    structuredContent: { total, receivableAccounts }
                }
            } catch (error) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Failed to list receivable accounts. Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                };
            }
        }
    )
}
