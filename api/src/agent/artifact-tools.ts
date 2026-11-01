import type { StructuredToolInterface } from "@langchain/core/tools"
import { tool } from "langchain"
import { z } from "zod"
import { ChartRequestSchema } from "../domain/chart-request.ts"
import {
    ChartNotFoundError, ChartNotPossibleError, ExportBusyError, ExportFailedError, ExportTimeoutError, ExportTooLargeError, NothingToExportError, ResultNotFoundError,
} from "../domain/errors.ts"
import { FileFormatSchema } from "../domain/file-descriptor.ts"
import { asksForFullPersonalData } from "../domain/full-pii-request.ts"
import type { ChartService } from "../services/chart.service.ts"
import type { ExportService } from "../services/export.service.ts"
import type { ResultStore } from "../services/result-store.repository.ts"

export const ARTIFACT_TOOL_NAMES: readonly string[] = ["resultados_disponiveis", "gerar_grafico", "exportar_arquivo"]

export type ArtifactToolDeps = { results: ResultStore; exports: ExportService; charts: ChartService; now?: () => Date }
export type ArtifactToolContext = { conversationId: string; userMessage: string; requestId: string }

const NO_RESULT = "Os dados dessa consulta não estão mais disponíveis para exportar. Explique e ofereça refazer a consulta."
const HHMM = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })

function size(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`
}

export function exportErrorText(err: unknown): string {
    if (err instanceof ResultNotFoundError) return NO_RESULT
    if (err instanceof NothingToExportError) return "O resultado não tem registros; não gere arquivo. Ofereça ajustar a consulta."
    if (err instanceof ExportTooLargeError) return `O resultado tem ${err.rows} linhas e o limite por arquivo é ${err.maxRows}. Explique e sugira reduzir o período ou filtrar.`
    if (err instanceof ExportBusyError) return "Há exportações em andamento. Peça para a pessoa tentar de novo em alguns segundos."
    if (err instanceof ExportTimeoutError) return "A geração demorou demais. Sugira reduzir o período e tentar de novo."
    if (err instanceof ChartNotFoundError) return "O gráfico indicado não está mais disponível. Gere o arquivo sem ele ou gere o gráfico de novo."
    if (err instanceof ExportFailedError) return "Não foi possível gerar o arquivo agora. Peça para tentar de novo."
    return "Não foi possível gerar o arquivo agora. Peça para tentar de novo."
}

export function chartErrorText(err: unknown): string {
    if (err instanceof ResultNotFoundError) return "Não há dados consultados nesta conversa para montar o gráfico. Ofereça fazer a consulta primeiro."
    if (err instanceof ChartNotPossibleError) return err.reason
    return "Não foi possível montar o gráfico agora. Responda em texto."
}

// local tools (they never write to the DKSOFT API); built per run because they need the conversation and the last user message
export function createArtifactToolBuilder(deps: ArtifactToolDeps) {
    const now = deps.now ?? (() => new Date())
    return (ctx: ArtifactToolContext): StructuredToolInterface[] => {
        const listResults = tool(
            async () => {
                const list = deps.results.list(ctx.conversationId)
                if (list.length === 0) return ["Nenhum resultado disponível para exportar nesta conversa.", undefined]
                const lines = list.map((r, i) => `${i + 1}. resultId=${r.id} · ${r.label} · ${r.rows.length} registros · há ${Math.max(0, Math.round((now().getTime() - Date.parse(r.createdAt)) / 60000))} min`)
                return [lines.join("\n"), undefined]
            },
            { name: "resultados_disponiveis", description: "Lista os resultados de consultas já feitos nesta conversa e que podem virar arquivo ou gráfico (do mais recente ao mais antigo).", schema: z.object({}), responseFormat: "content_and_artifact" },
        )

        const chart = tool(
            async (input) => {
                try {
                    const spec = deps.charts.create({ conversationId: ctx.conversationId, request: input, requestId: ctx.requestId })
                    return [`Gráfico exibido: "${spec.title}". ${spec.summary} Comente o gráfico em até 2 frases, sem repetir todos os números.`, spec]
                } catch (err) {
                    return [chartErrorText(err), undefined]
                }
            },
            {
                name: "gerar_grafico",
                description: "Mostra um gráfico na conversa a partir dos registros já consultados. Informe só como agrupar e o que medir; os valores são calculados pelo sistema. Use para comparar categorias, mostrar evolução no tempo ou distribuição. Não use para um valor único.",
                schema: ChartRequestSchema, responseFormat: "content_and_artifact",
            },
        )

        const exportFile = tool(
            async (input) => {
                try {
                    const result = input.resultId ? deps.results.get(ctx.conversationId, input.resultId) : deps.results.latest(ctx.conversationId)
                    if (!result) return [NO_RESULT, undefined]
                    const chartId = input.incluirGrafico ? deps.results.latestChart(ctx.conversationId, result.id)?.id : undefined
                    const wantsFull = input.dadosPessoaisCompletos === true
                    const full = wantsFull && asksForFullPersonalData(ctx.userMessage)
                    const file = await deps.exports.export({
                        conversationId: ctx.conversationId, resultId: result.id, format: input.formato, maskPersonalData: !full, origin: "chat", requestId: ctx.requestId, chartId,
                    })
                    const notes = [
                        wantsFull && !full ? "A pessoa não pediu dados completos de forma explícita, então o arquivo saiu mascarado; avise isso." : "",
                        input.incluirGrafico && !chartId ? "Não havia gráfico para incluir." : "",
                    ].filter(Boolean).join(" ")
                    return [
                        `Arquivo gerado: ${file.name} (${file.format}, ${file.rowCount} linhas, ${size(file.sizeBytes)}), válido até ${HHMM.format(new Date(file.expiresAt))}. Resultado exportado: ${result.label}. Dados pessoais: ${full ? "completos" : "mascarados"}. ${notes} O cartão de download já aparece na conversa; confirme em uma frase e diga qual resultado foi exportado.`.replace(/\s+/g, " "),
                        file,
                    ]
                } catch (err) {
                    return [exportErrorText(err), undefined]
                }
            },
            {
                name: "exportar_arquivo",
                description: "Gera um arquivo (PDF, Excel ou Word) com os registros já consultados e mostra o cartão de download na conversa. Use só quando a pessoa pedir arquivo, planilha, PDF ou Word. Diga qual resultado será exportado. Nunca digite valores: o arquivo usa os registros guardados. Dados pessoais saem mascarados, a menos que a pessoa peça explicitamente os dados completos.",
                schema: z.object({
                    resultId: z.string().optional().describe("Resultado a exportar; omita para usar o mais recente"),
                    formato: FileFormatSchema.describe("pdf, xlsx (Excel) ou docx (Word)"),
                    incluirGrafico: z.boolean().optional().describe("Inclui o gráfico mais recente deste resultado, se houver"),
                    dadosPessoaisCompletos: z.boolean().optional().describe("Só vale se a pessoa pediu explicitamente CPF/e-mail/telefone completos"),
                }),
                responseFormat: "content_and_artifact",
            },
        )
        return [listResults, chart, exportFile] as unknown as StructuredToolInterface[]
    }
}
