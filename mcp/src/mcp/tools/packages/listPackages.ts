import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { PackageService } from "../../../application/packageService.ts";
import { PackageSchema } from "../../../domain/package.ts";



export function registerListPackagesTool(
    server: McpServer,
    service: PackageService
) {

    server.registerTool(
        "list_packages",
        {
            description: "List all packages",
            inputSchema: {},
            outputSchema: {
                packages: z.array(
                    PackageSchema
                ).describe('Array of all packages')
            }
        },
        async () => {
            try {
                const { pacotes: packages } = await service.listPackages()
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(packages, null, 2)
                        }
                    ],
                    structuredContent: { packages }
                }
            } catch (error) {
                return {
                    isError: true,
                    content: [
                        {
                            type: "text",
                            text: `Failed to list packages. Error: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                };
            }
        }
    )
}