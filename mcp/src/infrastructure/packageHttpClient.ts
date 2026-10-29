import { type Package } from "../domain/package.ts";
import { withBearerToken, type FetchFn } from "./authInterceptor.ts";

export class PackageHttpClient {
    private baseUrl: string
    private readonly fetch: FetchFn
    constructor(baseUrl: string, fetchFn: FetchFn = withBearerToken()) {
        this.baseUrl = baseUrl
        this.fetch = fetchFn
    }


    async listPackages(): Promise<any> {
        const res = await this.fetch(`${this.baseUrl}/pacotes`)
        return res.json() as Promise<Package[]>
    }
}
