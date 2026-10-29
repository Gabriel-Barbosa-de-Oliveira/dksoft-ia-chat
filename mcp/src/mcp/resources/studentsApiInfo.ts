import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStudentsApiInfoResource(
    server: McpServer,
    baseUrl: string
){
    server.registerResource(
        "students://api-info",
        "students://api-info",
        {
            description: "describes the students rest API that this MCP server wraps"
        },
        () => ({
            contents: [
                {
                    uri: "students://api-info",
                    mimeType: "text/plain",
                    text: `
Students API

  Base URL : ${baseUrl}
  Auth     : Bearer token
  Endpoints:
    GET    /alunos?data_inicial=YYYY-MM-DD&data_final=YYYY-MM-DD[&limite=1..500][&offset=n]
           — list students registered in the period (both dates required, limite defaults to 100)
    GET    /alunos/id/{id_aluno}            — student by id
    GET    /alunos/matricula/{matricula}    — student by enrollment number
    GET    /alunos/cpf/{cpf}                — student by CPF
    GET    /alunos/email/{email}            — student by email
    GET    /alunos/telefone/{telefone}      — students linked to a phone (student, guardian, father or mother)
    GET    /alunos/id/{id_aluno}/cursos            — courses of the student
    GET    /alunos/id/{id_aluno}/parcelas-abertas  — open installments of the student
    GET    /alunos/id/{id_aluno}/presencas         — attendance of the student
    GET    /alunos/id/{id_aluno}/provas            — exams of the student

  List response shape: { status: string, total_registros: number, limite: number, offset: number, tem_mais: boolean, alunos: Student[] }
  Student shape: {
    id_aluno: number, matricula, nome, nome_social, cpf, data_nascimento, sexo, data_cadastro,
    situacao, email, telefone, celular, telefone_contato: string | null,
    endereco: { tipo_logradouro, logradouro, numero, complemento, bairro, cep, cidade, estado },
    responsavel: { nome, tipo, parentesco, telefone, celular, zap, email, sexo, cidade, estado },
    pai: { nome, telefone, email }, mae: { nome, telefone, email }
  }
  Lookup by id/matricula/cpf/email: { status: string, ...Student }
  Phone lookup: { status, telefone_consultado, total, resultados: { id_aluno, matricula, nome_aluno, tipo_contato, nome_contato, campo_encontrado, telefone_encontrado, aluno }[] }
  Courses: { id_aluno, cursos: { id_aluno_curso, id_pacote, contrato, pacote, data_matricula, situacao }[] }
  Open installments: { id_aluno, parcelas: { numero_lancamento, id_aluno_curso, contrato, id_pacote, pacote, situacao_curso, vencimento, historico, valor, pj_link }[] }
  Attendance: { status, id_aluno, total_registros, total_presenca, total_falta, presencas: object[] }
  Exams: { status, id_aluno, total_provas, provas: object[] }

  Errors:
    400 — missing/invalid params (e.g. limite outside 1..500)
    401 — missing or invalid token
    404 — student not found
    429 — rate limit exceeded (60 requests per minute)
`
                }
            ]
        })
    )
}
