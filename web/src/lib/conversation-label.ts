/** Prévia de uma pergunta: espaços normalizados, até `max` caracteres, sem partir palavra quando possível. */
export function previewOf(text: string, max = 60): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trimEnd()}…`;
}

interface DayParts {
  year: number;
  month: number;
  day: number;
  time: string;
  monthName: string;
}

function partsOf(date: Date, locale: string, timeZone?: string): DayParts {
  const base = { locale, timeZone } as const;
  const nums = new Intl.DateTimeFormat(base.locale, {
    timeZone: base.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => nums.find((p) => p.type === type)?.value ?? "";
  const monthName = new Intl.DateTimeFormat(base.locale, { timeZone: base.timeZone, month: "short" })
    .format(date)
    .replace(/\.$/, "");
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    time: `${get("hour")}:${get("minute")}`,
    monthName,
  };
}

/** "Hoje, 14:32" · "Ontem, 09:10" · "28 out, 16:45" · "28 out 2025, 16:45". Relógio e fuso entram por parâmetro. */
export function formatConversationDate(iso: string, now: number | Date, locale = "pt-BR", timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const a = partsOf(date, locale, timeZone);
  const b = partsOf(new Date(now), locale, timeZone);
  const dayNumber = (p: DayParts) => Date.UTC(p.year, p.month - 1, p.day) / 86_400_000;
  const diff = dayNumber(b) - dayNumber(a);
  if (diff === 0) return `Hoje, ${a.time}`;
  if (diff === 1) return `Ontem, ${a.time}`;
  if (a.year === b.year) return `${a.day} ${a.monthName}, ${a.time}`;
  return `${a.day} ${a.monthName} ${a.year}, ${a.time}`;
}
