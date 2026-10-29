import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PackageService } from "../application/packageService.ts";
import { ReceivableAccountService } from "../application/receivableAccountService.ts";
import { registerListPackagesTool } from "./tools/packages/listPackages.ts";
import { registerListReceivableAccountsTool } from "./tools/receivable-accounts/receivableAccounts.ts";
import { registerPackageApiInfoResource } from "./resources/packagesApiInfo.ts";
import { registerFindPackagePrompt } from "./prompts/findPackages.ts";
import { registerReceivableAccountApiInfoResource } from "./resources/receivableAccountApiInfo.ts";
import { registerFindReceivableAccountsPrompt } from "./prompts/findReceivableAccounts.ts";

const BASE_URL = process.env.BASE_URL
if (!BASE_URL) {
    throw new Error("BASE_URL environment variable is not set")
}

const packageService = new PackageService(BASE_URL)
const receivableAccountService = new ReceivableAccountService(BASE_URL)
console.error(BASE_URL, "Base Url Configured")
export const server = new McpServer({
    name: "dksoft-mcp",
    version: "0.0.1",
});

registerListPackagesTool(server, packageService)
registerListReceivableAccountsTool(server, receivableAccountService)
registerPackageApiInfoResource(server, BASE_URL)
registerReceivableAccountApiInfoResource(server, BASE_URL)
registerFindPackagePrompt(server)
registerFindReceivableAccountsPrompt(server)
