export class ConversationNotFoundError extends Error {
    constructor(readonly conversationId: string) { super("Conversa não encontrada"); this.name = "ConversationNotFoundError" }
}
export class UnauthorizedError extends Error {
    constructor() { super("Chave de acesso ausente ou inválida"); this.name = "UnauthorizedError" }
}
export class OriginNotAllowedError extends Error {
    constructor() { super("Origem não autorizada"); this.name = "OriginNotAllowedError" }
}
export class ChatTimeoutError extends Error {
    constructor() { super("A pergunta excedeu o tempo máximo"); this.name = "ChatTimeoutError" }
}
export class ModelUnavailableError extends Error {
    constructor(options?: { cause?: unknown }) { super("Modelo de IA indisponível", options); this.name = "ModelUnavailableError" }
}
export class ToolsUnavailableError extends Error {
    constructor(options?: { cause?: unknown }) { super("Consultas aos dados indisponíveis", options); this.name = "ToolsUnavailableError" }
}
export class PeriodTooLongError extends Error {
    constructor(readonly maxDays: number) { super(`O período máximo por pergunta é de ${maxDays} dias`); this.name = "PeriodTooLongError" }
}
export class InvalidPeriodError extends Error {
    constructor(message: string) { super(message); this.name = "InvalidPeriodError" }
}
