import { ChatOpenAI } from "@langchain/openai"

export function createChatModel(modelId: string, apiKey: string): ChatOpenAI {
    return new ChatOpenAI({
        model: modelId,
        apiKey,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
        useResponsesApi: false,
        streaming: true,
        temperature: 0,
        maxRetries: 0,
    })
}
