const LABELS: Record<string, string> = {
    dksoft_list_packages: "Consultando os pacotes…",
    dksoft_find_student: "Buscando o aluno…",
    dksoft_find_students_by_phone: "Buscando alunos pelo telefone…",
    dksoft_list_students: "Listando alunos…",
    dksoft_list_student_courses: "Consultando os cursos do aluno…",
    dksoft_list_student_open_installments: "Consultando parcelas em aberto…",
    dksoft_list_student_attendance: "Consultando as presenças…",
    dksoft_list_student_exams: "Consultando as provas…",
    dksoft_list_paid_bills: "Consultando contas pagas…",
    dksoft_list_receivable_accounts: "Consultando contas recebidas…",
    financeiro_contas_pagas_periodo: "Consultando contas pagas no período…",
    financeiro_contas_recebidas_periodo: "Consultando contas recebidas no período…",
}

export function toolLabel(name: string): string {
    return LABELS[name] ?? "Consultando os dados…"
}
