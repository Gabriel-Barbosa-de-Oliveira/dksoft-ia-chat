// Mede tempo, memória e atraso do laço de eventos da geração de arquivos (riscos R3 e R4 da spec 004).
// Uso: node --expose-gc --import tsx api/scripts/bench-export.ts   (fora de src/ e da imagem de produção)
import { performance } from "node:perf_hooks"
import { buildExportTable } from "../src/domain/export-table.ts"
import type { FileFormat } from "../src/domain/file-descriptor.ts"
import { createDocumentRenderer } from "../src/render/worker-pool.ts"

const FORMATS: FileFormat[] = ["pdf", "xlsx", "docx"]
const mb = (n: number) => Math.round((n / 1024 / 1024) * 10) / 10
const rss = () => mb(process.memoryUsage().rss)

function table(n: number) {
    const rows = Array.from({ length: n }, (_, i) => ({
        aluno: `Aluno de Teste ${i + 1} Ação`,
        valor_pago: 100 + (i % 17) * 12.5,
        data_pagamento: `2026-10-${String((i % 28) + 1).padStart(2, "0")}`,
        forma_pagamento: i % 3 === 0 ? "PIX" : i % 3 === 1 ? "Cartão" : "Boleto",
        pacote: `Pacote ${(i % 5) + 1}`,
    }))
    return buildExportTable({ toolName: "dksoft_list_paid_bills", filters: {}, rows, totalRows: n, capped: false }, { maskPersonalData: true, now: new Date() })
}

// 3 streams simulados: um "token" a cada 20 ms; mede o atraso real de cada tick
function startStreams(count = 3) {
    let worst = 0
    let ticks = 0
    const timers = Array.from({ length: count }, () => {
        let expected = performance.now() + 20
        return setInterval(() => {
            const late = performance.now() - expected
            if (late > worst) worst = late
            ticks++
            expected = performance.now() + 20
        }, 20)
    })
    return { stop: () => (timers.forEach(clearInterval), { worstLagMs: Math.round(worst), ticks }) }
}

const renderer = createDocumentRenderer({ timeoutMs: 120_000, maxConcurrency: 2 })
const out: string[] = []
const log = (s: string) => (console.log(s), out.push(s))

try {
    log(`Node ${process.version} · ${process.platform} · ${new Date().toISOString()}`)
    log("| linhas | formato | tempo (s) | tamanho (KB) | atraso máx. do laço com 3 streams (ms) | RSS depois (MB) |")
    log("|---|---|---|---|---|---|")
    for (const n of [1000, 5000]) {
        const t = table(n)
        for (const format of FORMATS) {
            const streams = startStreams()
            const start = performance.now()
            const bytes = await renderer.render({ format, table: t })
            const seconds = (performance.now() - start) / 1000
            const { worstLagMs } = streams.stop()
            log(`| ${n} | ${format} | ${seconds.toFixed(2)} | ${Math.round(bytes.byteLength / 1024)} | ${worstLagMs} | ${rss()} |`)
        }
    }

    log("")
    log("Estabilização de memória: 20 exportações seguidas (1.000 linhas, 3 formatos em rodízio)")
    const t = table(1000)
    const samples: number[] = []
    for (let i = 0; i < 20; i++) {
        await renderer.render({ format: FORMATS[i % 3]!, table: t })
        ;(globalThis as { gc?: () => void }).gc?.()
        samples.push(rss())
    }
    log(`RSS (MB) a cada exportação: ${samples.join(", ")}`)
    const first = samples.slice(0, 5).reduce((a, b) => a + b, 0) / 5
    const last = samples.slice(-5).reduce((a, b) => a + b, 0) / 5
    log(`Média das 5 primeiras: ${first.toFixed(1)} MB · média das 5 últimas: ${last.toFixed(1)} MB · variação: ${(last - first).toFixed(1)} MB`)
} finally {
    await renderer.close?.()
}
