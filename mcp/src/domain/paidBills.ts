import z from "zod";

// fields typed only as null in the openapi spec; real type inferred from the field name
// text fields are nullable: the real API returns null (e.g. responsavel) despite the spec marking them as required strings
export const PaidBillSchema = z.object({
    id_aluno: z.number().describe("ID of the student"),
    id_aluno_curso: z.number().nullable().optional().describe("ID of the student's course enrollment"),
    numero_lancamento: z.number().describe("Entry number of the bill"),
    vencimento: z.string().describe("Due date (YYYY-MM-DD)"),
    data_pagamento: z.string().describe("Payment date (YYYY-MM-DD)"),
    valor_pago: z.number().describe("Amount paid"),
    historico: z.string().nullable().describe("Description of the entry"),
    aluno: z.string().nullable().describe("Name of the student"),
    responsavel: z.string().nullable().describe("Name of the person financially responsible"),
    banco: z.string().nullable().describe("Bank"),
    subconta: z.string().nullable().describe("Sub-account"),
    conta: z.string().nullable().describe("Account"),
    pacote: z.string().nullable().optional().describe("Package related to the bill"),
    pag_nome: z.string().nullable().describe("Name of the payer"),
    centro_custo: z.string().nullable().describe("Cost center"),
    banco_caixa: z.string().nullable().describe("Bank or cash register where the payment was received"),
    hora: z.string().nullable().describe("Time of the payment"),
    aluno_situacao: z.string().nullable().describe("Status of the student"),
    situacao_personalizada: z.string().nullable().optional().describe("Custom status of the student"),
    situacao_curso: z.string().nullable().optional().describe("Status of the student's course"),
})
export type PaidBill = z.infer<typeof PaidBillSchema>

export const PaidBillsResponseSchema = z.object({
    tipo: z.string(),
    data_inicial: z.string(),
    data_final: z.string(),
    total_registros: z.number(),
    registros: z.array(PaidBillSchema),
})
export type PaidBillsResponse = z.infer<typeof PaidBillsResponseSchema>


export const PaidBillsQuerySchema = z.object({
    data_inicial: z.string().date().describe("Start date (YYYY-MM-DD). The range can be at most 30 days"),
    data_final: z.string().date().describe("End date (YYYY-MM-DD). The range can be at most 30 days"),
})
export type PaidBillsQuery = z.infer<typeof PaidBillsQuerySchema>

export const PaidBillsFilterSchema = PaidBillsQuerySchema.extend({
    aluno: z.string().optional().describe("Name (or part of the name) of the student"),
    pacote: z.string().optional().describe("Name (or part of the name) of the package"),
})
export type PaidBillsFilter = z.infer<typeof PaidBillsFilterSchema>


function includesIgnoreCase(value: string | null | undefined, search: string): boolean {
    return (value ?? "").toLowerCase().includes(search.toLowerCase())
}

export function filterPaidBills(
    bills: PaidBill[],
    { aluno, pacote }: Pick<PaidBillsFilter, "aluno" | "pacote">
): PaidBill[] {
    return bills.filter(bill =>
        (!aluno || includesIgnoreCase(bill.aluno, aluno)) &&
        (!pacote || includesIgnoreCase(bill.pacote, pacote))
    )
}

export const MAX_PAID_BILLS_PERIOD_DAYS = 30
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function validatePaidBillsPeriod(dataInicial: string, dataFinal: string): string | undefined {
    const start = new Date(dataInicial).getTime()
    const end = new Date(dataFinal).getTime()

    if (Number.isNaN(start) || Number.isNaN(end)) {
        return `Invalid period: data_inicial and data_final must be valid dates in the YYYY-MM-DD format.`
    }
    if (end < start) {
        return `Invalid period: data_final (${dataFinal}) must be on or after data_inicial (${dataInicial}).`
    }
    if ((end - start) / DAY_IN_MS + 1 > MAX_PAID_BILLS_PERIOD_DAYS) {
        return `It is not possible to search paid bills for the period from ${dataInicial} to ${dataFinal}. The period must be at most ${MAX_PAID_BILLS_PERIOD_DAYS} days, counting both dates.`
    }
}
