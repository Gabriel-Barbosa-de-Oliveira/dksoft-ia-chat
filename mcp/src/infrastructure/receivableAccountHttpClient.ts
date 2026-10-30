import { ReceivableAccountsResponseSchema, type ReceivableAccountQuery, type ReceivableAccountsResponse } from "../domain/receivableAccount.ts";
import { assertOk, parseResponse } from "./apiHttpError.ts";
import { withBearerToken, type FetchFn } from "./authInterceptor.ts";

export class ReceivableAccountHttpClient {
    private baseUrl: string
    private readonly fetch: FetchFn
    constructor(baseUrl: string, fetchFn: FetchFn = withBearerToken()) {
        this.baseUrl = baseUrl
        this.fetch = fetchFn
    }


    async listReceivableAccounts(query: ReceivableAccountQuery): Promise<ReceivableAccountsResponse> {
        const params = new URLSearchParams({
            data_inicial: query.data_inicial,
            data_final: query.data_final,
        })
        const res = await this.fetch(`${this.baseUrl}/financeiro/contas-recebidas?${params}`)
        await assertOk(res)
        return parseResponse(ReceivableAccountsResponseSchema, await res.json())
    }
}
