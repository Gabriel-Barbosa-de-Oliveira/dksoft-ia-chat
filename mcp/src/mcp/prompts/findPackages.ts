import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

// prompt arguments are always strings in MCP
const FindPackagesArgsSchema = z.object({
    id_pacote: z.string().optional().describe("ID of the package"),
    nome: z.string().optional().describe("Name (or part of the name) of the package"),
})

export function registerFindPackagePrompt(server: McpServer) {
    server.registerPrompt(
        "find_packages_prompt",
        {
            description: "Prompt to search for packages using any combination of id_pacote or name",
            argsSchema: FindPackagesArgsSchema.shape
        },
        (query) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Please find the packages matching the following query using the list_packages tool, filtering the result by id_pacote and/or nome.\nQuery: ${JSON.stringify(query)}`,
                    }
                }
            ]
        })
    )
}
