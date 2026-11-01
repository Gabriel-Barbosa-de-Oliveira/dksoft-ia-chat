import { formatChartValue } from "./chart-summary.ts"
import type { ChartSpec } from "./chart-spec.ts"
import { niceTicks } from "./nice-ticks.ts"

// fixed light theme for files; first series uses the product accent
export const SERIES_COLORS = ["#C8102E", "#1F2937", "#2563EB", "#059669", "#D97706", "#7C3AED"] as const
const TEXT = "#111827"
const GRID = "#D1D5DB"
const FONT = "Archivo"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const r1 = (n: number) => Math.round(n * 10) / 10
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const short = (kind: ChartSpec["valueKind"], v: number) => {
    const abs = Math.abs(v)
    const base = abs >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : abs >= 1e4 ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : formatChartValue(kind, v).replace("R$ ", "")
    return kind === "currency" && abs >= 1e4 ? `R$ ${base}` : base
}

function patternDefs(): string {
    const lines = [
        "", `<path d="M0,6 L6,0" stroke="#fff" stroke-width="1.5"/>`, `<path d="M0,0 L6,6" stroke="#fff" stroke-width="1.5"/>`,
        `<circle cx="3" cy="3" r="1.2" fill="#fff"/>`, `<path d="M3,0 L3,6" stroke="#fff" stroke-width="1.5"/>`, `<path d="M0,3 L6,3" stroke="#fff" stroke-width="1.5"/>`,
    ]
    return lines.map((l, i) => (l ? `<pattern id="hatch${i}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${SERIES_COLORS[i]}"/>${l}</pattern>` : "")).join("")
}
const fill = (i: number) => (i === 0 ? SERIES_COLORS[0] : `url(#hatch${i})`)

function marker(i: number, cx: number, cy: number): string {
    const c = SERIES_COLORS[i]!
    const s = 5
    switch (i % 6) {
        case 0: return `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${s}" fill="${c}"/>`
        case 1: return `<rect x="${r1(cx - s)}" y="${r1(cy - s)}" width="${2 * s}" height="${2 * s}" fill="${c}"/>`
        case 2: return `<path d="M${r1(cx)},${r1(cy - s - 1)} L${r1(cx + s + 1)},${r1(cy + s)} L${r1(cx - s - 1)},${r1(cy + s)} Z" fill="${c}"/>`
        case 3: return `<path d="M${r1(cx)},${r1(cy - s - 1)} L${r1(cx + s + 1)},${r1(cy)} L${r1(cx)},${r1(cy + s + 1)} L${r1(cx - s - 1)},${r1(cy)} Z" fill="${c}"/>`
        case 4: return `<path d="M${r1(cx - s)},${r1(cy - s)} L${r1(cx + s)},${r1(cy + s)} M${r1(cx + s)},${r1(cy - s)} L${r1(cx - s)},${r1(cy + s)}" stroke="${c}" stroke-width="2.5"/>`
        default: return `<path d="M${r1(cx)},${r1(cy - s - 1)} L${r1(cx + 1.5)},${r1(cy - 1.5)} L${r1(cx + s + 1)},${r1(cy)} L${r1(cx + 1.5)},${r1(cy + 1.5)} L${r1(cx)},${r1(cy + s + 1)} L${r1(cx - 1.5)},${r1(cy + 1.5)} L${r1(cx - s - 1)},${r1(cy)} L${r1(cx - 1.5)},${r1(cy - 1.5)} Z" fill="${c}"/>`
    }
}

function legend(names: string[], x: number, y: number, width: number, markers: boolean): { svg: string; height: number } {
    let cx = x
    let cy = y
    let out = ""
    names.forEach((n, i) => {
        const label = cut(n, 28)
        const w = 30 + label.length * 7
        if (cx + w > x + width && cx > x) { cx = x; cy += 22 }
        out += markers ? marker(i, cx + 7, cy) : `<rect x="${cx}" y="${cy - 7}" width="14" height="14" fill="${fill(i)}"/>`
        out += `<text x="${cx + 20}" y="${cy + 4}" font-size="12" fill="${TEXT}">${esc(label)}</text>`
        cx += w
    })
    return { svg: out, height: cy - y + 22 }
}

// pure and deterministic: the same ChartSpec values the front draws, as SVG (light theme)
export function renderChartSvg(spec: ChartSpec, size: { width: number; height: number }): string {
    const { width, height } = size
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT}"><defs>${patternDefs()}</defs><rect width="${width}" height="${height}" fill="#fff"/>`
    const title = `<text x="20" y="28" font-size="18" font-family="Archivo SemiBold, Archivo" fill="${TEXT}">${esc(cut(spec.title, 90))}</text>${spec.subtitle ? `<text x="20" y="48" font-size="12" fill="#4B5563">${esc(spec.subtitle)}</text>` : ""}`
    const showLegend = spec.type === "pie" || spec.series.length > 1
    const names = spec.type === "pie" ? spec.categories : spec.series.map((s) => s.name)
    const lg = showLegend ? legend(names, 20, 0, width - 40, spec.type === "line") : { svg: "", height: 0 }
    const legendH = showLegend ? lg.height + 8 : 0
    const top = 66
    const bottom = height - legendH - 8
    let body = ""

    if (spec.type === "pie") {
        const vals = spec.series[0]!.values
        const total = vals.reduce((a, b) => a + b, 0) || 1
        const cx = width / 2
        const cy = (top + bottom) / 2
        const rad = Math.max(20, Math.min((bottom - top) / 2 - 6, width / 2 - 100))
        let a0 = -Math.PI / 2
        const one = vals.filter((v) => v > 0).length === 1
        vals.forEach((v, i) => {
            if (v <= 0) return
            const a1 = a0 + (v / total) * Math.PI * 2
            if (one) body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(rad)}" fill="${fill(i)}" stroke="#fff" stroke-width="2"/>`
            else {
                const large = a1 - a0 > Math.PI ? 1 : 0
                body += `<path d="M${r1(cx)},${r1(cy)} L${r1(cx + rad * Math.cos(a0))},${r1(cy + rad * Math.sin(a0))} A${r1(rad)},${r1(rad)} 0 ${large} 1 ${r1(cx + rad * Math.cos(a1))},${r1(cy + rad * Math.sin(a1))} Z" fill="${fill(i)}" stroke="#fff" stroke-width="2"/>`
            }
            if (v / total >= 0.05) {
                const mid = (a0 + a1) / 2
                const lx = cx + (rad + 18) * Math.cos(mid)
                body += `<text x="${r1(lx)}" y="${r1(cy + (rad + 18) * Math.sin(mid) + 4)}" font-size="12" text-anchor="${Math.cos(mid) >= 0 ? "start" : "end"}" fill="${TEXT}">${Math.round((v / total) * 100)}%</text>`
            }
            a0 = a1
        })
    } else {
        const left = 80
        const right = width - 24
        const plotBottom = bottom - 34
        const all = spec.series.flatMap((s) => s.values)
        const lo = Math.min(0, ...all)
        const hi = Math.max(0, ...all)
        const t = niceTicks(lo, hi, 5)
        const y = (v: number) => plotBottom - ((v - t.min) / (t.max - t.min || 1)) * (plotBottom - top)
        for (const tick of t.ticks) {
            body += `<line x1="${left}" x2="${right}" y1="${r1(y(tick))}" y2="${r1(y(tick))}" stroke="${GRID}" stroke-width="1"/>`
            body += `<text x="${left - 8}" y="${r1(y(tick) + 4)}" font-size="11" text-anchor="end" fill="#4B5563">${esc(short(spec.valueKind, tick))}</text>`
        }
        body += `<line x1="${left}" x2="${right}" y1="${r1(y(0))}" y2="${r1(y(0))}" stroke="${TEXT}" stroke-width="2"/>`
        const band = (right - left) / spec.categories.length
        const maxChars = Math.max(3, Math.floor(band / 6.5))
        const every = Math.max(1, Math.ceil(9 / maxChars))
        spec.categories.forEach((c, i) => {
            if (i % every !== 0 && i !== spec.categories.length - 1) return
            body += `<text x="${r1(left + band * (i + 0.5))}" y="${plotBottom + 18}" font-size="11" text-anchor="middle" fill="#4B5563">${esc(cut(c, Math.min(14, maxChars * every)))}</text>`
        })
        if (spec.type === "bar") {
            const n = spec.series.length
            const bw = Math.max(2, (band * 0.76) / n)
            spec.series.forEach((s, si) => s.values.forEach((v, i) => {
                const x = left + band * i + band * 0.12 + bw * si
                const y0 = y(Math.max(v, 0))
                const h = Math.max(0.5, Math.abs(y(v) - y(0)))
                body += `<rect x="${r1(x)}" y="${r1(y0)}" width="${r1(bw)}" height="${r1(h)}" fill="${fill(si)}"/>`
            }))
        } else {
            spec.series.forEach((s, si) => {
                const pts = s.values.map((v, i) => [left + band * (i + 0.5), y(v)] as const)
                body += `<polyline points="${pts.map(([x, yy]) => `${r1(x)},${r1(yy)}`).join(" ")}" fill="none" stroke="${SERIES_COLORS[si]}" stroke-width="2.5"/>`
                for (const [x, yy] of pts) body += marker(si, x, yy)
            })
        }
        if (spec.yLabel) body += `<text x="20" y="${top - 8}" font-size="11" fill="#4B5563">${esc(cut(spec.yLabel, 40))}</text>`
    }
    const legendSvg = showLegend ? `<g transform="translate(0 ${height - legendH + 6})">${lg.svg}</g>` : ""
    return `${head}${title}${body}${legendSvg}</svg>`
}
