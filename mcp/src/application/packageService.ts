import { type PackagesResponse } from "../domain/package.ts";
import { PackageHttpClient } from "../infrastructure/packageHttpClient.ts";


export class PackageService {
    private readonly client: PackageHttpClient
    constructor(baseUrl: string) {
        this.client = new PackageHttpClient(baseUrl)
    }

    async listPackages(): Promise<PackagesResponse> {
        return await this.client.listPackages()
    }
}