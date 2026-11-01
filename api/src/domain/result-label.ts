export type ResultFilters = { dataInicial?: string; dataFinal?: string; aluno?: string; pacote?: string }

const SUBJECTS: Record<string, { label: string; slug: string }> = {
    dksoft_list_packages: { label: "Pacotes", slug: "pacotes" },
    dksoft_find_student: { label: "Dados de um aluno", slug: "aluno" },
    dksoft_find_students_by_phone: { label: "Alunos encontrados pelo telefone", slug: "alunos" },
    dksoft_list_students: { label: "Alunos", slug: "alunos" },
    dksoft_list_student_courses: { label: "Cursos de um aluno", slug: "cursos" },
    dksoft_list_student_open_installments: { label: "Parcelas em aberto de um aluno", slug: "parcelas-em-aberto" },
    dksoft_list_student_attendance: { label: "Presenças de um aluno", slug: "presencas" },
    dksoft_list_student_exams: { label: "Provas de um aluno", slug: "provas" },
    dksoft_list_paid_bills: { label: "Contas pagas", slug: "contas-pagas" },
    dksoft_list_receivable_accounts: { label: "Contas recebidas", slug: "contas-recebidas" },
    financeiro_contas_pagas_periodo: { label: "Contas pagas", slug: "contas-pagas" },
    financeiro_contas_recebidas_periodo: { label: "Contas recebidas", slug: "contas-recebidas" },
}

// fixed subject per tool (never personal data) used in file names
export function subjectSlug(toolName: string): string {
    return SUBJECTS[toolName]?.slug ?? "consulta"
}

export function subjectTitle(toolName: string): string {
    return SUBJECTS[toolName]?.label ?? "Resultado da consulta"
}

const isoDate = /^(\d{4})-(\d{2})-(\d{2})/
export function brDate(iso: string): string {
    const m = isoDate.exec(iso)
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v : undefined)

// pure: readable description without personal data (a student name in `args` is never copied to the label)
export function describeResult(toolName: string, args: unknown): { label: string; filters: ResultFilters } {
    const a = (args && typeof args === "object" ? args : {}) as Record<string, unknown>
    const filters: ResultFilters = {}
    const ini = str(a.data_inicial)
    const fim = str(a.data_final)
    if (ini) filters.dataInicial = ini
    if (fim) filters.dataFinal = fim
    const aluno = str(a.aluno)
    const pacote = str(a.pacote)
    if (aluno) filters.aluno = aluno
    if (pacote) filters.pacote = pacote
    const title = subjectTitle(toolName)
    const label = ini && fim ? `${title}, ${brDate(ini)} a ${brDate(fim)}` : title
    return { label, filters }
}
