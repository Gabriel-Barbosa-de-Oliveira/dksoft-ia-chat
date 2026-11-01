import type { ColumnKind } from "./column-dictionary.ts"
import type { Cell } from "./export-table.ts"

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const INT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 })
const DEC = new Intl.NumberFormat("pt-BR")
const p2 = (n: number) => String(n).padStart(2, "0")

export const formatDateBr = (d: Date) => `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`

const SP = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
// instant -> "31/10/2026 18:30" in America/Sao_Paulo
export const formatInstantSp = (d: Date) => SP.format(d).replace(",", "")

// pure: display text of a typed cell (used by PDF and Word; Excel keeps typed values)
export function formatCell(cell: Cell, kind: ColumnKind): string {
    if (cell === null) return ""
    if (cell instanceof Date) return formatDateBr(cell)
    if (typeof cell === "number") return (kind === "money" ? BRL.format(cell) : kind === "integer" ? INT.format(cell) : DEC.format(cell)).replace(/ /g, " ")
    return cell
}
