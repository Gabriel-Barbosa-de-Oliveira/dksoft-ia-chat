import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { PaidBillsService } from "../../../application/paidBillsService.ts";
import {
    PaidBillsFilterSchema,
    PaidBillSchema,
    filterPaidBills,
    validatePaidBillsPeriod,
} from "../../../domain/paidBills.ts";



export function registerListPaidBillsTool(
    server: McpServer,
    service: PaidBillsService
) {

    server.registerTool(
        "list_paid_bills",
        {
            description: "List the bills paid between data_inicial and data_final (max. 30 days), optionally filtered by student (aluno) and/or package (pacote)",
            inputSchema: PaidBillsFilterSchema.shape,
            outputSchema: {
                total: z.number().describe('Total of paid bills returned'),
                paidBills: z.array(
                    PaidBillSchema
                ).describe('Array of paid bills in the period')
            }
        },
        async ({ data_inicial, data_final, aluno, pacote }) => {
            const periodError = validatePaidBillsPeriod(data_inicial, data_final)
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
                const { registros } = await service.listPaidBills({ data_inicial, data_final })
                const paidBills = filterPaidBills(registros, { aluno, pacote })
                const total = paidBills.length
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(paidBills, null, 2)
                        }
                    ],
                    structuredContent: { total, paidBills }
                }
            } catch (error) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Failed to list paid bills. Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                };
            }
        }
    )
}
