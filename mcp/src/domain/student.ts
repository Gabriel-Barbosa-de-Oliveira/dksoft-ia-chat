import z from "zod";

// fields typed only as null in api-types.ts are optional strings: the mapper saw only null values but the real API fills them for some students
const nullableText = () => z.string().nullable().optional()

export const StudentAddressSchema = z.object({
    tipo_logradouro: nullableText().describe("Street type (rua, avenida...)"),
    logradouro: nullableText().describe("Street"),
    numero: nullableText().describe("Number"),
    complemento: nullableText().describe("Complement"),
    bairro: nullableText().describe("Neighborhood"),
    cep: nullableText().describe("Postal code (CEP)"),
    cidade: nullableText().describe("City"),
    estado: nullableText().describe("State"),
})

export const StudentGuardianSchema = z.object({
    nome: nullableText().describe("Name of the person financially responsible"),
    tipo: nullableText().describe("Type of the guardian"),
    parentesco: nullableText().describe("Relationship with the student"),
    telefone: nullableText().describe("Phone"),
    celular: nullableText().describe("Mobile phone"),
    zap: nullableText().describe("WhatsApp"),
    email: nullableText().describe("Email"),
    sexo: nullableText().describe("Sex"),
    cidade: nullableText().describe("City"),
    estado: nullableText().describe("State"),
})

export const StudentParentSchema = z.object({
    nome: nullableText().describe("Name"),
    telefone: nullableText().describe("Phone"),
    email: nullableText().describe("Email"),
})

export const StudentSchema = z.object({
    id_aluno: z.number().describe("ID of the student"),
    matricula: nullableText().describe("Enrollment number of the student"),
    nome: nullableText().describe("Name of the student"),
    nome_social: nullableText().describe("Social name of the student"),
    cpf: nullableText().describe("CPF of the student"),
    data_nascimento: nullableText().describe("Birth date (YYYY-MM-DD)"),
    sexo: nullableText().describe("Sex"),
    data_cadastro: nullableText().describe("Registration date (YYYY-MM-DD)"),
    situacao: nullableText().describe("Status of the student"),
    email: nullableText().describe("Email"),
    telefone: nullableText().describe("Phone"),
    celular: nullableText().describe("Mobile phone"),
    telefone_contato: nullableText().describe("Contact phone"),
    endereco: StudentAddressSchema.nullable().optional().describe("Address"),
    responsavel: StudentGuardianSchema.nullable().optional().describe("Person financially responsible"),
    pai: StudentParentSchema.nullable().optional().describe("Father"),
    mae: StudentParentSchema.nullable().optional().describe("Mother"),
})
export type Student = z.infer<typeof StudentSchema>

export const StudentsResponseSchema = z.object({
    status: z.string(),
    total_registros: z.number(),
    limite: z.number(),
    offset: z.number(),
    tem_mais: z.boolean(),
    alunos: z.array(StudentSchema),
})
export type StudentsResponse = z.infer<typeof StudentsResponseSchema>

// GET /alunos/id/{id}, /matricula/{m}, /cpf/{cpf} and /email/{email} return the student at the root, next to status
export const StudentDetailResponseSchema = StudentSchema.extend({
    status: z.string(),
})
export type StudentDetailResponse = z.infer<typeof StudentDetailResponseSchema>


export const StudentPhoneMatchSchema = z.object({
    id_aluno: z.number().describe("ID of the student"),
    matricula: nullableText().describe("Enrollment number of the student"),
    nome_aluno: nullableText().describe("Name of the student"),
    tipo_contato: nullableText().describe("Whose phone matched (aluno, responsavel, pai, mae...)"),
    nome_contato: nullableText().describe("Name of the contact whose phone matched"),
    campo_encontrado: nullableText().describe("Field where the phone was found"),
    telefone_encontrado: nullableText().describe("Phone found"),
    aluno: StudentSchema.partial().nullable().optional().describe("Student data"),
})
export type StudentPhoneMatch = z.infer<typeof StudentPhoneMatchSchema>

export const StudentsByPhoneResponseSchema = z.object({
    status: z.string(),
    telefone_consultado: z.string(),
    total: z.number(),
    resultados: z.array(StudentPhoneMatchSchema),
})
export type StudentsByPhoneResponse = z.infer<typeof StudentsByPhoneResponseSchema>


export const StudentCourseSchema = z.object({
    id_aluno_curso: z.number().describe("ID of the student's course enrollment"),
    id_pacote: z.number().describe("ID of the package"),
    contrato: nullableText().describe("Contract"),
    pacote: nullableText().describe("Name of the package"),
    data_matricula: nullableText().describe("Enrollment date (YYYY-MM-DD)"),
    situacao: nullableText().describe("Status of the course"),
})
export type StudentCourse = z.infer<typeof StudentCourseSchema>

export const StudentCoursesResponseSchema = z.object({
    id_aluno: z.number(),
    cursos: z.array(StudentCourseSchema),
})
export type StudentCoursesResponse = z.infer<typeof StudentCoursesResponseSchema>

export const StudentOpenInstallmentSchema = z.object({
    numero_lancamento: z.number().describe("Entry number of the installment"),
    id_aluno_curso: z.number().describe("ID of the student's course enrollment"),
    contrato: nullableText().describe("Contract"),
    id_pacote: z.number().describe("ID of the package"),
    pacote: nullableText().describe("Name of the package"),
    situacao_curso: nullableText().describe("Status of the course"),
    vencimento: z.string().describe("Due date (YYYY-MM-DD)"),
    historico: nullableText().describe("Description of the entry"),
    valor: z.number().describe("Amount due"),
    pj_link: nullableText().describe("Payment link"),
})
export type StudentOpenInstallment = z.infer<typeof StudentOpenInstallmentSchema>

export const StudentOpenInstallmentsResponseSchema = z.object({
    id_aluno: z.number(),
    parcelas: z.array(StudentOpenInstallmentSchema),
})
export type StudentOpenInstallmentsResponse = z.infer<typeof StudentOpenInstallmentsResponseSchema>

// items of presencas and provas were always empty while mapping the API, so their shape is unknown
export const StudentAttendanceResponseSchema = z.object({
    status: z.string(),
    id_aluno: z.number(),
    total_registros: z.number(),
    total_presenca: z.number(),
    total_falta: z.number(),
    presencas: z.array(z.record(z.unknown())),
})
export type StudentAttendanceResponse = z.infer<typeof StudentAttendanceResponseSchema>

export const StudentExamsResponseSchema = z.object({
    status: z.string(),
    id_aluno: z.number(),
    total_provas: z.number(),
    provas: z.array(z.record(z.unknown())),
})
export type StudentExamsResponse = z.infer<typeof StudentExamsResponseSchema>


export const MAX_STUDENTS_PAGE_SIZE = 500

export const StudentsQuerySchema = z.object({
    data_inicial: z.string().date().describe("Start of the registration period (YYYY-MM-DD)"),
    data_final: z.string().date().describe("End of the registration period (YYYY-MM-DD)"),
    limite: z.number().int().min(1).max(MAX_STUDENTS_PAGE_SIZE).optional().describe("Maximum number of students per page, between 1 and 500 (API default: 100)"),
    offset: z.number().int().nonnegative().optional().describe("Number of students to skip, for pagination"),
})
export type StudentsQuery = z.infer<typeof StudentsQuerySchema>

export const StudentsFilterSchema = StudentsQuerySchema.extend({
    nome: z.string().optional().describe("Name (or part of the name) of the student, filtered on the returned page"),
    situacao: z.string().optional().describe("Status code of the student, filtered on the returned page: A (ativo), I (inativo) or F (meaning not documented)"),
})
export type StudentsFilter = z.infer<typeof StudentsFilterSchema>

export const STUDENT_LOOKUP_FIELDS = ["id", "matricula", "cpf", "email"] as const
export type StudentLookupField = typeof STUDENT_LOOKUP_FIELDS[number]

export const StudentLookupSchema = z.object({
    campo: z.enum(STUDENT_LOOKUP_FIELDS).describe("Field used to find the student: id (id_aluno), matricula, cpf or email"),
    valor: z.string().min(1).describe("Value of the chosen field"),
})
export type StudentLookup = z.infer<typeof StudentLookupSchema>

export const StudentIdSchema = z.object({
    id_aluno: z.number().int().positive().describe("ID of the student"),
})
export type StudentId = z.infer<typeof StudentIdSchema>

export const StudentPhoneSchema = z.object({
    telefone: z.string().min(1).describe("Phone of the student or of the guardian, father or mother (digits only)"),
})
export type StudentPhone = z.infer<typeof StudentPhoneSchema>


function includesIgnoreCase(value: string | null | undefined, search: string): boolean {
    return (value ?? "").toLowerCase().includes(search.toLowerCase())
}

// the API returns situacao as a code, but agents usually ask for the word
function situacaoCode(search: string): string | undefined {
    const word = search.trim()
    if (/^inativ[oa]s?$/i.test(word)) return "I"
    if (/^ativ[oa]s?$/i.test(word)) return "A"
    return undefined
}

function matchesSituacao(value: string | null | undefined, search: string): boolean {
    const code = situacaoCode(search)
    return code ? value?.toUpperCase() === code : includesIgnoreCase(value, search)
}

export function filterStudents(
    students: Student[],
    { nome, situacao }: Pick<StudentsFilter, "nome" | "situacao">
): Student[] {
    return students.filter(student =>
        (!nome || includesIgnoreCase(student.nome, nome) || includesIgnoreCase(student.nome_social, nome)) &&
        (!situacao || matchesSituacao(student.situacao, situacao))
    )
}
