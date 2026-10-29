import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PackageService } from "../application/packageService.ts";

const BASE_URL = process.env.BASE_URL
if (!BASE_URL) {
    throw new Error("BASE_URL environment variable is not set")
}

const packageService = new PackageService(BASE_URL)
console.error(BASE_URL, "Base Url Configured")
export const server = new McpServer({
    name: "dksoft-mcp",
    version: "0.0.1",
});
