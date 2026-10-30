const CPF = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /(?:\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g
const LONG_DIGITS = /\d{10,11}/g

const keepLast2 = (digits: string) => "*".repeat(Math.max(digits.length - 2, 0)) + digits.slice(-2)

// pure: masks CPF, e-mail and BR phone numbers keeping only the last 2 digits
export function maskPii(text: string): string {
    return text
        .replace(EMAIL, "***@***")
        .replace(CPF, (m) => keepLast2(m.replace(/\D/g, "")))
        .replace(PHONE, (m) => keepLast2(m.replace(/\D/g, "")))
        .replace(LONG_DIGITS, (m) => keepLast2(m))
}
