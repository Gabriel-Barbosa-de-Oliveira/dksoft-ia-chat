import type { ChartSpec } from "./chart-spec.ts";

/** Geometria pura dos gráficos (sem DOM). Todas as medidas são números em unidades do `viewBox`. */
export interface Box {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Ticks {
  ticks: number[];
  min: number;
  max: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Marcações "bonitas" (passos 1, 2 ou 5 × 10ⁿ) que cobrem [min, max]. */
export function niceTicks(min: number, max: number, count = 5): Ticks {
  if (min === max) {
    if (min === 0) return { ticks: [0, 1], min: 0, max: 1 };
    return niceTicks(Math.min(0, min), Math.max(0, max), count);
  }
  const rough = (max - min) / Math.max(1, count);
  const pow = 10 ** Math.floor(Math.log10(rough));
  const frac = rough / pow;
  const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks: ticks.map((t) => Math.round(t * 1e9) / 1e9), min: ticks[0]!, max: ticks.at(-1)! };
}

export function scaleLinear(domain: readonly [number, number], range: readonly [number, number]): (v: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d0 === d1) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

function valueExtent(spec: ChartSpec, includeZero: boolean): [number, number] {
  const all = spec.series.flatMap((s) => s.values);
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  return [lo, hi];
}

export interface AxisTick {
  value: number;
  pos: number;
}
export interface CategoryLabel {
  label: string;
  pos: number;
  index: number;
}

export interface BarRect {
  series: number;
  category: number;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface BarsLayout {
  orientation: "vertical" | "horizontal";
  ticks: AxisTick[];
  zero: number;
  bars: BarRect[];
  labels: CategoryLabel[];
}

/** Barras agrupadas por categoria. `horizontal` troca os eixos (rótulos longos em telas estreitas). */
export function layoutBars(spec: ChartSpec, box: Box, orientation: "vertical" | "horizontal" = "vertical"): BarsLayout {
  const { ticks, min, max } = niceTicks(...valueExtent(spec, true));
  const vertical = orientation === "vertical";
  const plotW = box.width - box.left - box.right;
  const plotH = box.height - box.top - box.bottom;
  const value = vertical
    ? scaleLinear([min, max], [box.top + plotH, box.top])
    : scaleLinear([min, max], [box.left, box.left + plotW]);
  const span = vertical ? plotW : plotH;
  const bandSize = span / spec.categories.length;
  const inner = bandSize * 0.8;
  const barSize = inner / spec.series.length;
  const zero = value(0);
  const bars: BarRect[] = [];
  const labels: CategoryLabel[] = [];
  spec.categories.forEach((label, c) => {
    const bandStart = (vertical ? box.left : box.top) + c * bandSize + (bandSize - inner) / 2;
    labels.push({ label, pos: round((vertical ? box.left : box.top) + c * bandSize + bandSize / 2), index: c });
    spec.series.forEach((s, i) => {
      const v = s.values[c] ?? 0;
      const at = value(v);
      const start = bandStart + i * barSize;
      bars.push(
        vertical
          ? { series: i, category: c, value: v, x: round(start), y: round(Math.min(at, zero)), width: round(barSize), height: round(Math.abs(zero - at)) }
          : { series: i, category: c, value: v, x: round(Math.min(at, zero)), y: round(start), width: round(Math.abs(at - zero)), height: round(barSize) },
      );
    });
  });
  return { orientation, ticks: ticks.map((t) => ({ value: t, pos: round(value(t)) })), zero: round(zero), bars, labels };
}

export interface LinePoint {
  category: number;
  value: number;
  x: number;
  y: number;
}
export interface LinesLayout {
  ticks: AxisTick[];
  lines: Array<{ series: number; d: string; points: LinePoint[] }>;
  labels: CategoryLabel[];
}

export function layoutLines(spec: ChartSpec, box: Box): LinesLayout {
  const { ticks, min, max } = niceTicks(...valueExtent(spec, true));
  const plotW = box.width - box.left - box.right;
  const plotH = box.height - box.top - box.bottom;
  const y = scaleLinear([min, max], [box.top + plotH, box.top]);
  const n = spec.categories.length;
  const xAt = (i: number) => (n === 1 ? box.left + plotW / 2 : box.left + (i / (n - 1)) * plotW);
  const labels = spec.categories.map((label, index) => ({ label, pos: round(xAt(index)), index }));
  const lines = spec.series.map((s, series) => {
    const points = s.values.map((value, category) => ({ category, value, x: round(xAt(category)), y: round(y(value)) }));
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
    return { series, d, points };
  });
  return { ticks: ticks.map((t) => ({ value: t, pos: round(y(t)) })), lines, labels };
}

export interface PieSlice {
  category: number;
  label: string;
  value: number;
  share: number;
  startAngle: number;
  endAngle: number;
  /** Caminho do setor; vazio quando a fatia vale zero. */
  d: string;
}
export interface PieLayout {
  cx: number;
  cy: number;
  r: number;
  total: number;
  slices: PieSlice[];
}

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: round(cx + r * Math.cos(rad)), y: round(cy + r * Math.sin(rad)) };
};

/** Pizza (primeira série). Ângulos em graus a partir do topo, no sentido horário; somam 360 quando há total. */
export function layoutPie(spec: ChartSpec, box: Box): PieLayout {
  const values = spec.series[0]!.values;
  const total = values.reduce((a, b) => a + b, 0);
  const cx = box.left + (box.width - box.left - box.right) / 2;
  const cy = box.top + (box.height - box.top - box.bottom) / 2;
  const r = Math.min(box.width - box.left - box.right, box.height - box.top - box.bottom) / 2;
  let angle = 0;
  const slices = values.map((value, category) => {
    const share = total > 0 ? value / total : 0;
    const sweep = share * 360;
    const startAngle = angle;
    const endAngle = category === values.length - 1 && total > 0 ? 360 : angle + sweep;
    angle = endAngle;
    let d = "";
    if (share > 0) {
      if (share >= 0.9999) {
        const a = polar(cx, cy, r, 0);
        const b = polar(cx, cy, r, 180);
        d = `M${a.x} ${a.y} A${r} ${r} 0 1 1 ${b.x} ${b.y} A${r} ${r} 0 1 1 ${a.x} ${a.y} Z`;
      } else {
        const a = polar(cx, cy, r, startAngle);
        const b = polar(cx, cy, r, endAngle);
        d = `M${cx} ${cy} L${a.x} ${a.y} A${r} ${r} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
      }
    }
    return { category, label: spec.categories[category] ?? "", value, share, startAngle: round(startAngle), endAngle: round(endAngle), d };
  });
  return { cx, cy, r, total, slices };
}

/**
 * Quais rótulos mostrar sem sobrepor: estima a largura de cada um (`charPx` por caractere) e escolhe um passo fixo.
 * Sempre mostra o primeiro e o último.
 */
export function thinLabels(labels: readonly string[], widthPx: number, minGapPx: number, charPx = 7): boolean[] {
  const n = labels.length;
  if (n === 0) return [];
  const widest = Math.max(...labels.map((l) => l.length)) * charPx;
  const slot = n > 1 ? widthPx / (n - 1) : widthPx;
  const step = Math.max(1, Math.ceil((widest + minGapPx) / Math.max(1, slot)));
  const show = labels.map((_, i) => i % step === 0);
  show[0] = true;
  show[n - 1] = true;
  if (n > 1 && step > 1) {
    // o último entra sempre; se ficou colado no anterior, o anterior sai
    for (let i = n - 2; i >= Math.max(1, n - step); i--) if (show[i]) show[i] = false;
  }
  return show;
}
