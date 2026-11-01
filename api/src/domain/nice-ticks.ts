// pure: "nice" axis ticks (1, 2, 5 x 10^n) covering [min, max]
export function niceTicks(min: number, max: number, count = 5): { ticks: number[]; min: number; max: number } {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return { ticks: [0, 1], min: 0, max: 1 }
    if (min === max) { max = min + 1; if (min > 0) min = 0 }
    const rough = (max - min) / Math.max(1, count)
    const pow = 10 ** Math.floor(Math.log10(rough))
    const frac = rough / pow
    const step = (frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10) * pow
    const lo = Math.floor(min / step) * step
    const hi = Math.ceil(max / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number((Math.round(v / step) * step).toPrecision(12)))
    return { ticks, min: lo, max: hi }
}
