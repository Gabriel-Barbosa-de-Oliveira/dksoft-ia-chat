import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { StudentService } from "../../../application/studentService.ts";
import { StudentSchema, StudentsFilterSchema, filterStudents } from "../../../domain/student.ts";
import { toolError, toolSuccess } from "./toolResponse.ts";



export function registerListStudentsTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "list_students",
        {
            description: "List the students registered between data_inicial and data_final, paginated with limite (1-500) and offset. Optionally filters the returned page by nome and/or situacao. When tem_mais is true, call again with offset + limite to get the next page",
            inputSchema: StudentsFilterSchema.shape,
            outputSchema: {
                total: z.number().describe('Total of students returned after the filters'),
                offset: z.number().describe('Offset of the returned page'),
                limite: z.number().describe('Page size used by the API'),
                tem_mais: z.boolean().describe('Indicates if there are more students after this page'),
                students: z.array(
                    StudentSchema
                ).describe('Array of students in the page')
            }
        },
        async ({ data_inicial, data_final, limite, offset, nome, situacao }) => {
            if (data_final < data_inicial) {
                return toolError("list students", `data_final (${data_final}) must be on or after data_inicial (${data_inicial}).`)
            }

            try {
                const page = await service.listStudents({ data_inicial, data_final, limite, offset })
                const students = filterStudents(page.alunos, { nome, situacao })
                const result = {
                    total: students.length,
                    offset: page.offset,
                    limite: page.limite,
                    tem_mais: page.tem_mais,
                    students,
                }
                return toolSuccess(result, result)
            } catch (error) {
                return toolError("list students", error)
            }
        }
    )
}
