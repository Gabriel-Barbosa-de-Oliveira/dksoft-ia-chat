import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerApiInfoResource(
    server: McpServer,
    baseUrl: string
){
    server.registerResource(
        "packages://api-info",
        "packages://api-info",
        {
            description: "describes the packages rest API that this MCP server wraps"
        },
        () => ({
            contents: [
                {
                    uri: "packages://api-info",
                    mimeType: "text/plain",
                    text: `
Packages API

  Base URL : ${baseUrl}
  Auth     : Bearer token
  Endpoints:
    GET    /pacotes            — list all packages

  Response shape: { status: string, total: number, pacotes: Package[] }
  Package shape : { id_pacote: number, nome: string, carga_horaria?: number | null, modulos: Module[] }
  Module shape  : { id_modulo: number, nome: string, sequencia: number, carga_horaria?: number | null }
`
                }
            ]
        })
    )
}
