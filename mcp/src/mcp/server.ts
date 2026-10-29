import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { CustomerService } from "./service.ts";

const BASE_URL = process.env.BASE_URL
// const service = new CustomerService(BASE_URL)
console.log(BASE_URL, "Base Url Configured")
export const server = new McpServer({
    name: "dksoft-mcp",
    version: "0.0.1",
});