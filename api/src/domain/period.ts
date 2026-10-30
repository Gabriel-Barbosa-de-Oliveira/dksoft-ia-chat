import { InvalidPeriodError, PeriodTooLongError } from "./errors.ts"

export type PeriodWindow = { inicio: string; fim: string }

export const MAX_WINDOW_DAYS = 30
export const MAX_TOTAL_DAYS = 90
const DAY = 24 * 60 * 60 * 1000

function parseDate(value: string): number {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!m) throw new InvalidPeriodError(`Data inválida: ${value}. Use o formato AAAA-MM-DD.`)
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const t = Date.UTC(y, mo - 1, d)
    const back = new Date(t)
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) {
        throw new InvalidPeriodError(`Data inexistente: ${value}.`)
    }
    return t
}
const fmt = (t: number) => new Date(t).toISOString().slice(0, 10)

// pure: consecutive inclusive windows of up to `windowDays` days, no gap and no overlap; max 90 days in total
export function splitPeriod(inicio: string, fim: string, windowDays: number = MAX_WINDOW_DAYS): PeriodWindow[] {
    const start = parseDate(inicio)
    const end = parseDate(fim)
    if (end < start) throw new InvalidPeriodError(`Período invertido: ${fim} é anterior a ${inicio}.`)
    const totalDays = Math.round((end - start) / DAY) + 1
    if (totalDays > MAX_TOTAL_DAYS) throw new PeriodTooLongError(MAX_TOTAL_DAYS)
    const windows: PeriodWindow[] = []
    for (let cur = start; cur <= end; cur += windowDays * DAY) {
        windows.push({ inicio: fmt(cur), fim: fmt(Math.min(cur + (windowDays - 1) * DAY, end)) })
    }
    return windows
}
