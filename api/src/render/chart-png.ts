import { Resvg } from "@resvg/resvg-js"
import type { ChartSpec } from "../domain/chart-spec.ts"
import { renderChartSvg } from "../domain/chart-svg.ts"
import { FONT_REGULAR, FONT_SEMIBOLD } from "./fonts.ts"

export const CHART_PX = { width: 1000, height: 560 }

// SVG -> PNG with the bundled Archivo fonts only (the production image has no system fonts)
export function renderChartPng(spec: ChartSpec): Uint8Array {
    const svg = renderChartSvg(spec, CHART_PX)
    const png = new Resvg(svg, {
        background: "#ffffff",
        fitTo: { mode: "width", value: CHART_PX.width },
        font: { loadSystemFonts: false, fontFiles: [FONT_REGULAR, FONT_SEMIBOLD], defaultFontFamily: "Archivo" },
    }).render().asPng()
    return new Uint8Array(png)
}
