import { PaidBillsResponseSchema, type PaidBillsQuery, type PaidBillsResponse } from "../domain/paidBills.ts";
import { assertOk, parseResponse } from "./apiHttpError.ts";
import { withBearerToken, type FetchFn } from "./authInterceptor.ts";

export class PaidBillsHttpClient {
    private baseUrl: string
    private readonly fetch: FetchFn
    constructor(baseUrl: string, fetchFn: FetchFn = withBearerToken()) {
        this.baseUrl = baseUrl
        this.fetch = fetchFn
    }


    async listPaidBills(query: PaidBillsQuery): Promise<PaidBillsResponse> {
        const params = new URLSearchParams({
            data_inicial: query.data_inicial,
            data_final: query.data_final,
        })
        const res = await this.fetch(`${this.baseUrl}/financeiro/contas-pagas?${params}`)
        await assertOk(res)
        return parseResponse(PaidBillsResponseSchema, await res.json())
    }
}
