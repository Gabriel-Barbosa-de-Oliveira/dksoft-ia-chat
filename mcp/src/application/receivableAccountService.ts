import { type ReceivableAccountQuery, type ReceivableAccountsResponse } from "../domain/receivableAccount.ts";
import { ReceivableAccountHttpClient } from "../infrastructure/receivableAccountHttpClient.ts";


export class ReceivableAccountService {
    private readonly client: ReceivableAccountHttpClient
    constructor(baseUrl: string) {
        this.client = new ReceivableAccountHttpClient(baseUrl)
    }

    async listReceivableAccounts(query: ReceivableAccountQuery): Promise<ReceivableAccountsResponse> {
        return await this.client.listReceivableAccounts(query)
    }
}
