import { PackagesResponseSchema, type PackagesResponse } from "../domain/package.ts";
import { assertOk, parseResponse } from "./apiHttpError.ts";
import { withBearerToken, type FetchFn } from "./authInterceptor.ts";

export class PackageHttpClient {
    private baseUrl: string
    private readonly fetch: FetchFn
    constructor(baseUrl: string, fetchFn: FetchFn = withBearerToken()) {
        this.baseUrl = baseUrl
        this.fetch = fetchFn
    }


    async listPackages(): Promise<PackagesResponse> {
        const res = await this.fetch(`${this.baseUrl}/pacotes`)
        await assertOk(res)
        return parseResponse(PackagesResponseSchema, await res.json())
    }
}
