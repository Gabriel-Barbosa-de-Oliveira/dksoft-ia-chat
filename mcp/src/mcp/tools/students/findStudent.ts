import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { StudentService } from "../../../application/studentService.ts";
import {
    StudentLookupSchema,
    StudentPhoneMatchSchema,
    StudentPhoneSchema,
    StudentSchema,
} from "../../../domain/student.ts";
import { toolError, toolSuccess } from "./toolResponse.ts";



export function registerFindStudentTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "find_student",
        {
            description: "Find a single student with full registration data (address, guardian, parents) by one field: id (id_aluno), matricula, cpf or email",
            inputSchema: StudentLookupSchema.shape,
            outputSchema: {
                student: StudentSchema.describe('The found student')
            }
        },
        async ({ campo, valor }) => {
            try {
                const { status: _status, ...student } = await service.findStudent(campo, valor)
                return toolSuccess(student, { student })
            } catch (error) {
                return toolError(`find student by ${campo} "${valor}"`, error)
            }
        }
    )
}

export function registerFindStudentsByPhoneTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "find_students_by_phone",
        {
            description: "Find the students linked to a phone number. The phone is searched in the student's phones and in the guardian's, father's and mother's phones",
            inputSchema: StudentPhoneSchema.shape,
            outputSchema: {
                total: z.number().describe('Total of matches'),
                matches: z.array(
                    StudentPhoneMatchSchema
                ).describe('Students whose phones (or contacts\' phones) match')
            }
        },
        async ({ telefone }) => {
            try {
                const { total, resultados: matches } = await service.findStudentsByPhone(telefone)
                return toolSuccess(matches, { total, matches })
            } catch (error) {
                return toolError(`find students by phone "${telefone}"`, error)
            }
        }
    )
}
