/** Estilo de cada série: cor (token), forma do marcador e padrão de preenchimento. Cor nunca é o único canal. */
export type MarkerShape = "circle" | "square" | "triangle" | "diamond" | "cross" | "star";
export type FillPattern = "solid" | "diagonal" | "dots" | "horizontal" | "vertical" | "grid";

export interface SeriesStyle {
  /** Nome da variável CSS (`--chart-series-N`). */
  colorVar: string;
  marker: MarkerShape;
  pattern: FillPattern;
}

export const SERIES_MARKERS: readonly MarkerShape[] = ["circle", "square", "triangle", "diamond", "cross", "star"];
export const SERIES_PATTERNS: readonly FillPattern[] = ["solid", "diagonal", "dots", "horizontal", "vertical", "grid"];
export const SERIES_COUNT = 6;

export function seriesStyle(index: number): SeriesStyle {
  const i = ((index % SERIES_COUNT) + SERIES_COUNT) % SERIES_COUNT;
  return { colorVar: `--chart-series-${i + 1}`, marker: SERIES_MARKERS[i]!, pattern: SERIES_PATTERNS[i]! };
}

/** Pontos de um marcador centrado em (0,0) com "raio" r, para `<path>`/`<polygon>`. */
export function markerPath(shape: MarkerShape, r: number): string {
  switch (shape) {
    case "circle":
      return `M${-r} 0 A${r} ${r} 0 1 0 ${r} 0 A${r} ${r} 0 1 0 ${-r} 0 Z`;
    case "square":
      return `M${-r} ${-r} H${r} V${r} H${-r} Z`;
    case "triangle":
      return `M0 ${-r} L${r} ${r} L${-r} ${r} Z`;
    case "diamond":
      return `M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`;
    case "cross":
      return `M${-r} ${-r / 3} H${-r / 3} V${-r} H${r / 3} V${-r / 3} H${r} V${r / 3} H${r / 3} V${r} H${-r / 3} V${r / 3} H${-r} Z`;
    case "star": {
      const pts: string[] = [];
      for (let k = 0; k < 10; k++) {
        const radius = k % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * k - Math.PI / 2;
        pts.push(`${Math.round(radius * Math.cos(a) * 100) / 100} ${Math.round(radius * Math.sin(a) * 100) / 100}`);
      }
      return `M${pts.join(" L")} Z`;
    }
  }
}

/** Estilo de uma fatia de pizza: até 6 iguais às séries; da 7ª em diante repete a cor com outro padrão. */
export function sliceStyle(index: number): SeriesStyle {
  const base = seriesStyle(index);
  if (index < SERIES_COUNT) return base;
  return { ...base, pattern: SERIES_PATTERNS[(index - SERIES_COUNT + 3) % SERIES_COUNT]! };
}
