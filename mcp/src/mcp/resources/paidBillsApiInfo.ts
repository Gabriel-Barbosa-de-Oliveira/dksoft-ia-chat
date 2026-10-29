import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPaidBillsApiInfoResource(
    server: McpServer,
    baseUrl: string
){
    server.registerResource(
        "paid-bills://api-info",
        "paid-bills://api-info",
        {
            description: "describes the paid bills rest API that this MCP server wraps"
        },
        () => ({
            contents: [
                {
                    uri: "paid-bills://api-info",
                    mimeType: "text/plain",
                    text: `
Paid Bills API

  Base URL : ${baseUrl}
  Auth     : Bearer token
  Endpoints:
    GET    /financeiro/contas-pagas?data_inicial=YYYY-MM-DD&data_final=YYYY-MM-DD
           — list paid bills in the period (max. 30 days, both params required)

  Response shape: { tipo: string, data_inicial: string, data_final: string, total_registros: number, registros: PaidBill[] }
  PaidBill shape: {
    id_aluno: number, id_aluno_curso?: number | null, numero_lancamento: number,
    vencimento: string, data_pagamento: string, valor_pago: number, historico: string | null,
    aluno: string | null, responsavel: string | null, banco: string | null,
    subconta: string | null, conta: string | null, pacote?: string | null,
    pag_nome: string | null, centro_custo: string | null, banco_caixa: string | null,
    hora: string | null, aluno_situacao: string | null, situacao_personalizada?: string | null,
    situacao_curso?: string | null
  }

  Errors:
    400 — invalid params or period > 30 days
    401 — missing or invalid token
    429 — rate limit exceeded
`
                }
            ]
        })
    )
}
