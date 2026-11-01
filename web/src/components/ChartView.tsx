import { useId, useState, useSyncExternalStore } from "react";
import { chartDescription, chartTableRows, tooltipText } from "../lib/chart-a11y.ts";
import { layoutBars, layoutLines, layoutPie, thinLabels, type Box } from "../lib/chart-layout.ts";
import { markerPath, seriesStyle, sliceStyle, type FillPattern, type SeriesStyle } from "../lib/chart-palette.ts";
import type { ChartSpec } from "../lib/chart-spec.ts";
import { formatShare, formatValue } from "../lib/format-value.ts";
import { SectionBoundary } from "./SectionBoundary.tsx";
import { StatusNotice } from "./StatusNotice.tsx";
import styles from "./ChartView.module.css";

export interface ChartViewProps {
  chart: ChartSpec;
  /** Força o modo estreito (testes); por padrão acompanha a largura da janela. */
  narrow?: boolean;
}

const NARROW_QUERY = "(max-width: 30rem)";

const mediaAvailable = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

function subscribeNarrow(onChange: () => void): () => void {
  if (!mediaAvailable()) return () => {};
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const readNarrow = () => mediaAvailable() && window.matchMedia(NARROW_QUERY).matches;

function useNarrow(forced?: boolean): boolean {
  const live = useSyncExternalStore(subscribeNarrow, readNarrow, () => false);
  return forced ?? live;
}

interface Tip {
  text: string;
  x: number;
  y: number;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const PATTERN_SIZE = 6;

function Defs({ uid, styleList }: { uid: string; styleList: SeriesStyle[] }) {
  return (
    <defs>
      {styleList.map((st, i) =>
        st.pattern === "solid" ? null : (
          <pattern key={i} id={`${uid}-p${i}`} width={PATTERN_SIZE} height={PATTERN_SIZE} patternUnits="userSpaceOnUse">
            <rect width={PATTERN_SIZE} height={PATTERN_SIZE} style={{ fill: `var(${st.colorVar})` }} />
            <PatternMarks pattern={st.pattern} />
          </pattern>
        ),
      )}
    </defs>
  );
}

function PatternMarks({ pattern }: { pattern: FillPattern }) {
  const common = { className: styles.hatch, strokeWidth: 1.5 };
  switch (pattern) {
    case "diagonal":
      return <path d="M0 6 L6 0" {...common} />;
    case "dots":
      return <circle cx={3} cy={3} r={1.1} className={styles.hatchDot} />;
    case "horizontal":
      return <path d="M0 3 H6" {...common} />;
    case "vertical":
      return <path d="M3 0 V6" {...common} />;
    case "grid":
      return <path d="M0 3 H6 M3 0 V6" {...common} />;
    case "solid":
      return null;
  }
}

const fillOf = (uid: string, st: SeriesStyle, i: number) =>
  st.pattern === "solid" ? { fill: `var(${st.colorVar})` } : { fill: `url(#${uid}-p${i})` };

function Swatch({ uid, st, i, line }: { uid: string; st: SeriesStyle; i: number; line: boolean }) {
  return (
    <svg className={styles.swatch} viewBox="0 0 20 14" aria-hidden="true" focusable="false">
      {line ? (
        <>
          <path d="M0 7 H20" className={styles.swatchLine} style={{ stroke: `var(${st.colorVar})` }} />
          <path d={markerPath(st.marker, 4)} transform="translate(10 7)" style={{ fill: `var(${st.colorVar})` }} />
        </>
      ) : (
        <rect x={1} y={1} width={18} height={12} className={styles.swatchBox} style={fillOf(uid, st, i)} />
      )}
    </svg>
  );
}

function dims(chart: ChartSpec, narrow: boolean, horizontal: boolean): Box {
  if (chart.type === "pie") return narrow ? { width: 360, height: 240, top: 12, right: 12, bottom: 12, left: 12 } : { width: 640, height: 300, top: 12, right: 12, bottom: 12, left: 12 };
  if (horizontal) {
    const rows = chart.categories.length * (chart.series.length * 14 + 10);
    return { width: 360, height: rows + 48, top: 8, right: 16, bottom: 32, left: 96 };
  }
  return narrow
    ? { width: 360, height: 280, top: 12, right: 12, bottom: 44, left: 56 }
    : { width: 640, height: 320, top: 16, right: 16, bottom: 48, left: 72 };
}

function Figure({ chart, narrow: forcedNarrow }: ChartViewProps) {
  const uid = useId().replace(/:/g, "");
  const narrow = useNarrow(forcedNarrow);
  const [tip, setTip] = useState<Tip | null>(null);
  const isPie = chart.type === "pie";
  const horizontal = chart.type === "bar" && narrow && chart.categories.length > 5;
  const box = dims(chart, narrow, horizontal);
  const plotW = box.width - box.left - box.right;
  const styleList: SeriesStyle[] = isPie ? chart.categories.map((_, i) => sliceStyle(i)) : chart.series.map((_, i) => seriesStyle(i));
  const description = chartDescription(chart);
  const table = chartTableRows(chart);
  const showLegend = isPie || chart.series.length > 1;
  const show = (text: string, x: number, y: number) => setTip({ text, x, y });
  const hide = () => setTip(null);
  const fmt = (n: number) => formatValue(chart.valueKind, n, true);

  const bars = chart.type === "bar" ? layoutBars(chart, box, horizontal ? "horizontal" : "vertical") : null;
  const lines = chart.type === "line" ? layoutLines(chart, box) : null;
  const pie = isPie ? layoutPie(chart, box) : null;
  const cartesian = bars ?? lines;
  const catShow = cartesian && !horizontal ? thinLabels(cartesian.labels.map((l) => l.label), plotW, 8) : null;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.caption}>
        <span className={styles.title}>{chart.title}</span>
        {chart.subtitle ? <span className={styles.subtitle}>{chart.subtitle}</span> : null}
      </figcaption>
      {chart.partial ? (
        <StatusNotice variant="warning" title="Resultado parcial">
          O gráfico usa só os registros recebidos; refine a pergunta para ver o restante.
        </StatusNotice>
      ) : null}
      <svg
        className={styles.svg}
        viewBox={`0 0 ${box.width} ${box.height}`}
        role="img"
        fontSize={12}
        aria-labelledby={`${uid}-title ${uid}-desc`}
        onPointerLeave={hide}
      >
        <title id={`${uid}-title`}>{chart.title}</title>
        <desc id={`${uid}-desc`}>{description}</desc>
        <Defs uid={uid} styleList={styleList} />

        {cartesian ? (
          <g>
            {cartesian.ticks.map((t) =>
              horizontal ? (
                <g key={t.value}>
                  <line x1={t.pos} x2={t.pos} y1={box.top} y2={box.height - box.bottom} className={styles.grid} />
                  <text x={t.pos} y={box.height - box.bottom + 16} textAnchor="middle" className={styles.tick}>
                    {fmt(t.value)}
                  </text>
                </g>
              ) : (
                <g key={t.value}>
                  <line x1={box.left} x2={box.width - box.right} y1={t.pos} y2={t.pos} className={styles.grid} />
                  <text x={box.left - 8} y={t.pos + 4} textAnchor="end" className={styles.tick}>
                    {fmt(t.value)}
                  </text>
                </g>
              ),
            )}
            {cartesian.labels.map((l) =>
              horizontal ? (
                <text key={l.index} x={box.left - 8} y={l.pos + 4} textAnchor="end" className={styles.tick}>
                  {cut(l.label, 14)}
                </text>
              ) : catShow![l.index] ? (
                <text key={l.index} x={l.pos} y={box.height - box.bottom + 18} textAnchor="middle" className={styles.tick}>
                  {cut(l.label, 12)}
                </text>
              ) : null,
            )}
          </g>
        ) : null}

        {bars ? (
          <g>
            {bars.bars.map((b) => {
              const text = tooltipText(chart, b.series, b.category);
              return (
                <rect
                  key={`${b.series}-${b.category}`}
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  className={styles.bar}
                  style={fillOf(uid, styleList[b.series]!, b.series)}
                  onPointerEnter={() => show(text, b.x + b.width / 2, b.y)}
                  onPointerDown={() => show(text, b.x + b.width / 2, b.y)}
                />
              );
            })}
            {horizontal ? (
              <line x1={bars.zero} x2={bars.zero} y1={box.top} y2={box.height - box.bottom} className={styles.baseline} />
            ) : (
              <line x1={box.left} x2={box.width - box.right} y1={bars.zero} y2={bars.zero} className={styles.baseline} />
            )}
          </g>
        ) : null}

        {lines ? (
          <g>
            <line x1={box.left} x2={box.width - box.right} y1={lines.ticks.find((t) => t.value === 0)?.pos ?? box.height - box.bottom} y2={lines.ticks.find((t) => t.value === 0)?.pos ?? box.height - box.bottom} className={styles.baseline} />
            {lines.lines.map((ln) => {
              const st = styleList[ln.series]!;
              return (
                <g key={ln.series}>
                  {ln.points.length > 1 ? <path d={ln.d} className={styles.line} style={{ stroke: `var(${st.colorVar})` }} /> : null}
                  {ln.points.map((p) => {
                    const text = tooltipText(chart, ln.series, p.category);
                    return (
                      <path
                        key={p.category}
                        d={markerPath(st.marker, 5)}
                        transform={`translate(${p.x} ${p.y})`}
                        className={styles.marker}
                        style={{ fill: `var(${st.colorVar})` }}
                        onPointerEnter={() => show(text, p.x, p.y)}
                        onPointerDown={() => show(text, p.x, p.y)}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>
        ) : null}

        {pie
          ? pie.slices.map((s) => {
              if (s.d === "") return null;
              const text = tooltipText(chart, 0, s.category);
              const mid = ((s.startAngle + s.endAngle) / 2 - 90) * (Math.PI / 180);
              return (
                <path
                  key={s.category}
                  d={s.d}
                  className={styles.slice}
                  style={fillOf(uid, styleList[s.category]!, s.category)}
                  onPointerEnter={() => show(text, pie.cx + Math.cos(mid) * pie.r * 0.6, pie.cy + Math.sin(mid) * pie.r * 0.6)}
                  onPointerDown={() => show(text, pie.cx + Math.cos(mid) * pie.r * 0.6, pie.cy + Math.sin(mid) * pie.r * 0.6)}
                />
              );
            })
          : null}

        {tip ? <Tooltip tip={tip} box={box} /> : null}
        {chart.yLabel && !isPie ? (
          <text x={12} y={box.top - 2} className={styles.axisTitle}>
            {chart.yLabel}
          </text>
        ) : null}
        {chart.xLabel && !isPie && !horizontal ? (
          <text x={box.left + plotW / 2} y={box.height - 4} textAnchor="middle" className={styles.axisTitle}>
            {chart.xLabel}
          </text>
        ) : null}
      </svg>

      {showLegend ? (
        <ul className={styles.legend} aria-label="Legenda">
          {(isPie ? chart.categories : chart.series.map((s) => s.name)).map((name, i) => {
            const total = isPie ? chart.series[0]!.values.reduce((a, b) => a + b, 0) : 0;
            const value = isPie ? (chart.series[0]!.values[i] ?? 0) : 0;
            return (
              <li key={name} className={styles.legendItem}>
                <Swatch uid={uid} st={styleList[i]!} i={i} line={chart.type === "line"} />
                <span>
                  {name}
                  {isPie ? ` · ${formatShare(total > 0 ? value / total : 0)}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <details className={styles.details}>
        <summary className={styles.summary}>Ver dados em tabela</summary>
        <div className={styles.tableWrap} role="region" aria-label={`Dados de ${chart.title}`} tabIndex={0}>
          <table className={styles.table}>
            <caption className={styles.tableCaption}>{table.caption}</caption>
            <thead>
              <tr>
                {table.header.map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (c === 0 ? <th key={c} scope="row">{cell}</th> : <td key={c}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Tooltip({ tip, box }: { tip: Tip; box: Box }) {
  const width = Math.min(box.width - 8, tip.text.length * 6.6 + 16);
  const x = Math.max(4, Math.min(box.width - width - 4, tip.x - width / 2));
  const y = Math.max(4, tip.y - 30);
  return (
    <g pointerEvents="none" aria-hidden="true">
      <rect x={x} y={y} width={width} height={24} rx={4} className={styles.tipBox} />
      <text x={x + width / 2} y={y + 16} textAnchor="middle" className={styles.tipText}>
        {tip.text}
      </text>
    </g>
  );
}

/** Gráfico acessível (barras, linhas ou pizza). Se falhar ao desenhar, some e o texto da resposta continua. */
export function ChartView(props: ChartViewProps) {
  return (
    <SectionBoundary fallback={null}>
      <Figure {...props} />
    </SectionBoundary>
  );
}
