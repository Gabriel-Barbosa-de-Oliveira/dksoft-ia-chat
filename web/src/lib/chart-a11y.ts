import type { ChartSpec } from "./chart-spec.ts";
import { formatShare, formatValue } from "./format-value.ts";

export interface ChartTable {
  caption: string;
  header: string[];
  rows: string[][];
}

const total = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

/** Tabela de dados equivalente ao gráfico: todos os valores, em texto formatado. */
export function chartTableRows(spec: ChartSpec): ChartTable {
  const first = spec.xLabel ?? "Categoria";
  const caption = spec.subtitle ? `${spec.title}, ${spec.subtitle}` : spec.title;
  if (spec.type === "pie") {
    const values = spec.series[0]!.values;
    const sum = total(values);
    return {
      caption,
      header: [first, spec.series[0]!.name, "Participação"],
      rows: spec.categories.map((c, i) => [c, formatValue(spec.valueKind, values[i] ?? 0), formatShare(sum > 0 ? (values[i] ?? 0) / sum : 0)]),
    };
  }
  return {
    caption,
    header: [first, ...spec.series.map((s) => s.name)],
    rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => formatValue(spec.valueKind, s.values[i] ?? 0))]),
  };
}

/** Texto da dica de uma barra, ponto ou fatia: categoria, série e valor. */
export function tooltipText(spec: ChartSpec, seriesIndex: number, categoryIndex: number): string {
  const serie = spec.series[seriesIndex];
  const category = spec.categories[categoryIndex];
  if (!serie || category === undefined) return "";
  const value = serie.values[categoryIndex] ?? 0;
  const text = formatValue(spec.valueKind, value);
  if (spec.type === "pie") {
    const sum = total(serie.values);
    return `${category}: ${text} (${formatShare(sum > 0 ? value / sum : 0)})`;
  }
  return spec.series.length > 1 ? `${category} · ${serie.name}: ${text}` : `${category}: ${text}`;
}

/** Descrição longa do gráfico para leitores de tela. */
export function chartDescription(spec: ChartSpec): string {
  const text = spec.summary.trim();
  if (text !== "") return text;
  const kind = spec.type === "bar" ? "barras" : spec.type === "line" ? "linhas" : "pizza";
  return `Gráfico de ${kind} com ${spec.categories.length} categorias e ${spec.series.length} série${spec.series.length === 1 ? "" : "s"}.`;
}
