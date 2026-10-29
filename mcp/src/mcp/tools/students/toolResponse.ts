import { type CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function toolSuccess(text: unknown, structuredContent: Record<string, unknown>): CallToolResult {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(text, null, 2)
            }
        ],
        structuredContent
    }
}

export function toolError(action: string, error: unknown): CallToolResult {
    return {
        isError: true,
        content: [
            {
                type: "text",
                text: `Failed to ${action}. Error: ${error instanceof Error ? error.message : String(error)}`,
            },
        ],
    };
}
