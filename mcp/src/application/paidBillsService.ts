import { type PaidBillsQuery, type PaidBillsResponse } from "../domain/paidBills.ts";
import { PaidBillsHttpClient } from "../infrastructure/paidBillsHttpClient.ts";

export class PaidBillsService {
    private readonly client: PaidBillsHttpClient;

    constructor(baseUrl: string) {
        this.client = new PaidBillsHttpClient(baseUrl);
    }

    async listPaidBills(query: PaidBillsQuery): Promise<PaidBillsResponse> {
        return await this.client.listPaidBills(query)
    }
}