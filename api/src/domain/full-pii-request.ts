const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

const COMPLETE = /\b(completo|completa|completos|completas|inteiro|inteira|inteiros|inteiras|integral|integrais|sem mascara|sem mascarar|sem mascaramento|nao mascare|nao mascarar|sem ocultar|nao oculte)\b/
const TARGET = /\b(cpf|cpfs|e-?mail|e-?mails|telefone|telefones|celular|celulares|dados pessoais|dados de contato)\b/
const NEGATED = /\b(nao|sem)\s+(quero|preciso|precisa|precisamos|pedi|pedir|e necessario|e preciso)\b/
const UNMASK_PHRASE = /\b(sem|nao)\s+(mascar\w*|mascara)\b|\bnao oculte\b|\bsem ocultar\b/g

// pure: true only when the person explicitly asks for complete (unmasked) personal data in the text
export function asksForFullPersonalData(userMessage: string): boolean {
    const n = norm(userMessage)
    if (!COMPLETE.test(n) || !TARGET.test(n)) return false
    if (NEGATED.test(n)) return false
    const withoutUnmask = n.replace(UNMASK_PHRASE, " ")
    if (/\b(mascar\w*|mascarad\w*|oculte|ocultar|ocultad\w*)\b/.test(withoutUnmask)) return false
    return true
}
