import z from "zod";
import { PackageHttpClient } from "../infrastructure/packageHttpClient.ts";


export class PackageService {
    private readonly client: PackageHttpClient
    constructor(baseUrl: string) {
        this.client = new PackageHttpClient(baseUrl)
    }

    async listPackages(): Promise<any> {
        return await this.client.listPackages()
    }
}