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
export class ResultNotFoundError extends Error {
    constructor() { super("Os dados dessa consulta não estão mais disponíveis"); this.name = "ResultNotFoundError" }
}
export class FileNotFoundError extends Error {
    constructor() { super("Arquivo não encontrado"); this.name = "FileNotFoundError" }
}
export class ChartNotFoundError extends Error {
    constructor() { super("Gráfico não encontrado"); this.name = "ChartNotFoundError" }
}
export class NothingToExportError extends Error {
    constructor() { super("O resultado não tem registros"); this.name = "NothingToExportError" }
}
export class ExportTooLargeError extends Error {
    constructor(readonly rows: number, readonly maxRows: number) { super(`O resultado tem ${rows} linhas e o limite por arquivo é ${maxRows}`); this.name = "ExportTooLargeError" }
}
export class ExportBusyError extends Error {
    constructor(readonly retryAfterSeconds: number) { super("Há exportações em andamento"); this.name = "ExportBusyError" }
}
export class ExportTimeoutError extends Error {
    constructor() { super("A geração do arquivo demorou demais"); this.name = "ExportTimeoutError" }
}
export class ExportFailedError extends Error {
    constructor(options?: { cause?: unknown }) { super("Não foi possível gerar o arquivo", options); this.name = "ExportFailedError" }
}
export class ChartNotPossibleError extends Error {
    constructor(readonly reason: string) { super(reason); this.name = "ChartNotPossibleError" }
}
