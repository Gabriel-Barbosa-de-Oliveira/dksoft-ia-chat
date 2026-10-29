import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";

// prompt arguments are always strings in MCP
const FindStudentsArgsSchema = z.object({
    id_aluno: z.string().optional().describe("ID of the student"),
    matricula: z.string().optional().describe("Enrollment number of the student"),
    cpf: z.string().optional().describe("CPF of the student"),
    email: z.string().optional().describe("Email of the student"),
    telefone: z.string().optional().describe("Phone of the student or of a contact"),
    nome: z.string().optional().describe("Name (or part of the name) of the student"),
    data_inicial: z.string().optional().describe("Start of the registration period (YYYY-MM-DD), used to search by name"),
    data_final: z.string().optional().describe("End of the registration period (YYYY-MM-DD), used to search by name"),
})

export function registerFindStudentsPrompt(server: McpServer) {
    server.registerPrompt(
        "find_students_prompt",
        {
            description: "Prompt to search for students by id_aluno, matricula, cpf, email, telefone or name (within a registration period)",
            argsSchema: FindStudentsArgsSchema.shape
        },
        (query) => ({
            messages: [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `Please find the students matching the following query.
- If id_aluno, matricula, cpf or email is provided, use the find_student tool with the matching campo (id, matricula, cpf or email).
- If telefone is provided, use the find_students_by_phone tool.
- Otherwise, use the list_students tool with data_inicial, data_final and nome, following the pages while tem_mais is true. If the period is missing, ask the user for it.
To get the courses, open installments, attendance or exams of a found student, use list_student_courses, list_student_open_installments, list_student_attendance or list_student_exams with its id_aluno.
Query: ${JSON.stringify(query)}`,
                    }
                }
            ]
        })
    )
}
