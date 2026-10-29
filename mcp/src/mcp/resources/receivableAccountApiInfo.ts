import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerReceivableAccountApiInfoResource(
    server: McpServer,
    baseUrl: string
){
    server.registerResource(
        "receivable-accounts://api-info",
        "receivable-accounts://api-info",
        {
            description: "describes the receivable accounts rest API that this MCP server wraps"
        },
        () => ({
            contents: [
                {
                    uri: "receivable-accounts://api-info",
                    mimeType: "text/plain",
                    text: `
Receivable Accounts API

  Base URL : ${baseUrl}
  Auth     : Bearer token
  Endpoints:
    GET    /financeiro/contas-recebidas?data_inicial=YYYY-MM-DD&data_final=YYYY-MM-DD
           — list received accounts in the period (max. 30 days, both params required)

  Response shape: { tipo: string, data_inicial: string, data_final: string, total_registros: number, registros: ReceivableAccount[] }
  ReceivableAccount shape: {
    id_aluno: number, id_aluno_curso?: number | null, numero_lancamento: number,
    vencimento: string, data_pagamento: string, valor_pago: number, historico: string,
    aluno: string, responsavel: string, banco: string, subconta: string, conta: string,
    pacote?: string | null, pag_nome: string, centro_custo?: null, banco_caixa: string,
    hora: string, aluno_situacao: string, situacao_personalizada?: string | null,
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
