import type { ChartSpec } from "./chart-spec.ts";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** "R$ 1.234,50" (espaço comum, não o inseparável do Intl, para o texto casar em qualquer leitor). */
export function formatCurrency(n: number): string {
  return brl.format(n).replace(/ /g, " ");
}

/** "R$ 12,3 mil", "R$ 1,2 mi"; abaixo de mil mostra o valor inteiro em reais. */
export function formatCurrencyShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${oneDecimal.format(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${oneDecimal.format(abs / 1_000)} mil`;
  return formatCurrency(n);
}

export function formatInteger(n: number): string {
  return int.format(n);
}

export function formatIntegerShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${oneDecimal.format(abs / 1_000_000)} mi`;
  if (abs >= 10_000) return `${sign}${oneDecimal.format(abs / 1_000)} mil`;
  return formatInteger(n);
}

export function formatValue(kind: ChartSpec["valueKind"], n: number, short = false): string {
  if (kind === "currency") return short ? formatCurrencyShort(n) : formatCurrency(n);
  return short ? formatIntegerShort(n) : formatInteger(n);
}

/** Participação em pizza: "42,5%". */
export function formatShare(share: number): string {
  return `${oneDecimal.format(share * 100)}%`;
}
