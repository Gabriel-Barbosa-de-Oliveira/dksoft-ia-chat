import z from "zod";

export const ReceivableAccountSchema = z.object({
    id_aluno: z.number().describe("ID of the student"),
    id_aluno_curso: z.number().nullable().optional().describe("ID of the student's course enrollment"),
    numero_lancamento: z.number().describe("Entry number"),
    vencimento: z.string().describe("Due date (YYYY-MM-DD)"),
    data_pagamento: z.string().describe("Payment date (YYYY-MM-DD)"),
    valor_pago: z.number().describe("Amount paid"),
    historico: z.string().describe("Entry description"),
    aluno: z.string().describe("Name of the student"),
    responsavel: z.string().describe("Name of the student's guardian"),
    banco: z.string().describe("Bank or cash register that received the payment"),
    subconta: z.string().describe("Sub-account of the entry"),
    conta: z.string().describe("Account of the entry"),
    pacote: z.string().nullable().optional().describe("Name of the package"),
    pag_nome: z.string().describe("Name of the payer"),
    centro_custo: z.null().optional().describe("Cost center"),
    banco_caixa: z.string().describe("Indicates if the bank is a cash register (S/N)"),
    hora: z.string().describe("Payment time (HH:mm)"),
    aluno_situacao: z.string().describe("Status of the student"),
    situacao_personalizada: z.string().nullable().optional().describe("Custom status of the student"),
    situacao_curso: z.string().nullable().optional().describe("Status of the student's course"),
})
export type ReceivableAccount = z.infer<typeof ReceivableAccountSchema>

export const ReceivableAccountsResponseSchema = z.object({
    tipo: z.string(),
    data_inicial: z.string(),
    data_final: z.string(),
    total_registros: z.number(),
    registros: z.array(ReceivableAccountSchema),
})
export type ReceivableAccountsResponse = z.infer<typeof ReceivableAccountsResponseSchema>


export const ReceivableAccountQuerySchema = z.object({
    data_inicial: z.string().describe("Start date of the period (YYYY-MM-DD)"),
    data_final: z.string().describe("End date of the period (YYYY-MM-DD), max. 30 days after data_inicial"),
})
export type ReceivableAccountQuery = z.infer<typeof ReceivableAccountQuerySchema>

export const ReceivableAccountFilterSchema = ReceivableAccountQuerySchema.extend({
    aluno: z.string().optional().describe("Name (or part of the name) of the student"),
    pacote: z.string().optional().describe("Name (or part of the name) of the package"),
})
export type ReceivableAccountFilter = z.infer<typeof ReceivableAccountFilterSchema>


function includesIgnoreCase(value: string | null | undefined, search: string): boolean {
    return (value ?? "").toLowerCase().includes(search.toLowerCase())
}

export function filterReceivableAccounts(
    accounts: ReceivableAccount[],
    { aluno, pacote }: Pick<ReceivableAccountFilter, "aluno" | "pacote">
): ReceivableAccount[] {
    return accounts.filter(account =>
        (!aluno || includesIgnoreCase(account.aluno, aluno)) &&
        (!pacote || includesIgnoreCase(account.pacote, pacote))
    )
}


export const MAX_RECEIVABLE_PERIOD_DAYS = 30
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function validateReceivablePeriod(dataInicial: string, dataFinal: string): string | undefined {
    const start = new Date(dataInicial).getTime()
    const end = new Date(dataFinal).getTime()

    if (Number.isNaN(start) || Number.isNaN(end)) {
        return `Invalid period: data_inicial and data_final must be valid dates in the YYYY-MM-DD format.`
    }
    if (end < start) {
        return `Invalid period: data_final (${dataFinal}) must be on or after data_inicial (${dataInicial}).`
    }
    if ((end - start) / DAY_IN_MS > MAX_RECEIVABLE_PERIOD_DAYS) {
        return `It is not possible to search received accounts for the period from ${dataInicial} to ${dataFinal}. The period must be at most ${MAX_RECEIVABLE_PERIOD_DAYS} days.`
    }
}
