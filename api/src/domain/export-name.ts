import type { FileFormat } from "./file-descriptor.ts"
import { subjectSlug } from "./result-label.ts"

const FMT = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
})

function stamp(now: Date): string {
    const p = Object.fromEntries(FMT.formatToParts(now).map((x) => [x.type, x.value]))
    return `${p.year}${p.month}${p.day}-${p.hour}${p.minute}${p.second}`
}

// pure: <subject>-<YYYYMMDD-HHmmss>.<ext> in America/Sao_Paulo; suffix -2, -3 on collision
export function exportFileName(input: { toolName: string; format: FileFormat; now: Date; taken: readonly string[] }): string {
    const base = `${subjectSlug(input.toolName)}-${stamp(input.now)}`
    let name = `${base}.${input.format}`
    for (let i = 2; input.taken.includes(name); i++) name = `${base}-${i}.${input.format}`
    return name
}
