export type ColumnKind = "text" | "integer" | "money" | "date" | "datetime"
export type ColumnInfo = { label: string; kind: ColumnKind; sensitive: boolean }

const KNOWN: Record<string, { label: string; kind?: ColumnKind }> = {
    id_aluno: { label: "ID do aluno", kind: "integer" },
    id_aluno_curso: { label: "ID da matrícula no curso", kind: "integer" },
    id_pacote: { label: "ID do pacote", kind: "integer" },
    id_modulo: { label: "ID do módulo", kind: "integer" },
    matricula: { label: "Matrícula" },
    numero_lancamento: { label: "Nº do lançamento", kind: "integer" },
    vencimento: { label: "Vencimento", kind: "date" },
    data_pagamento: { label: "Data do pagamento", kind: "date" },
    data_nascimento: { label: "Data de nascimento", kind: "date" },
    data_cadastro: { label: "Data de cadastro", kind: "date" },
    data_matricula: { label: "Data da matrícula", kind: "date" },
    valor_pago: { label: "Valor pago", kind: "money" },
    valor: { label: "Valor", kind: "money" },
    historico: { label: "Histórico" },
    aluno: { label: "Aluno" },
    nome: { label: "Nome" },
    nome_social: { label: "Nome social" },
    responsavel: { label: "Responsável" },
    banco: { label: "Banco" },
    subconta: { label: "Subconta" },
    conta: { label: "Conta" },
    pacote: { label: "Pacote" },
    pag_nome: { label: "Forma de pagamento" },
    centro_custo: { label: "Centro de custo" },
    banco_caixa: { label: "Banco/Caixa" },
    hora: { label: "Hora" },
    aluno_situacao: { label: "Situação do aluno" },
    situacao: { label: "Situação" },
    situacao_curso: { label: "Situação do curso" },
    situacao_personalizada: { label: "Situação personalizada" },
    contrato: { label: "Contrato" },
    carga_horaria: { label: "Carga horária", kind: "integer" },
    sequencia: { label: "Sequência", kind: "integer" },
    sexo: { label: "Sexo" },
    cpf: { label: "CPF" },
    email: { label: "E-mail" },
    telefone: { label: "Telefone" },
    celular: { label: "Celular" },
    telefone_contato: { label: "Telefone de contato" },
    endereco: { label: "Endereço" },
    pai: { label: "Pai" },
    mae: { label: "Mãe" },
    modulos: { label: "Módulos" },
}

export const SENSITIVE_FIELDS: readonly string[] = ["cpf", "email", "telefone", "celular", "telefone_contato"]

export const COLUMN_ORDER: readonly string[] = [
    "id_aluno", "matricula", "aluno", "nome", "nome_social", "responsavel", "id_aluno_curso", "numero_lancamento", "pacote", "contrato",
    "vencimento", "data_pagamento", "hora", "valor", "valor_pago", "historico", "pag_nome", "banco", "banco_caixa", "subconta", "conta",
    "centro_custo", "aluno_situacao", "situacao", "situacao_curso", "situacao_personalizada",
    "cpf", "email", "telefone", "celular", "telefone_contato",
]

const prettify = (field: string) => {
    const t = field.replace(/_/g, " ").trim()
    return t.charAt(0).toUpperCase() + t.slice(1)
}

// pure: label (pt-BR), kind and sensitivity of a record field
export function describeColumn(field: string): ColumnInfo {
    const known = KNOWN[field]
    const sensitive = SENSITIVE_FIELDS.includes(field)
    if (known) return { label: known.label, kind: known.kind ?? "text", sensitive }
    if (/^valor/.test(field)) return { label: prettify(field), kind: "money", sensitive }
    if (/^data_|^dt_/.test(field)) return { label: prettify(field), kind: "date", sensitive }
    if (/^id_/.test(field)) return { label: prettify(field), kind: "integer", sensitive }
    return { label: prettify(field), kind: "text", sensitive }
}
