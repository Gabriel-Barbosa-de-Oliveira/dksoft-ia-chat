import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import z from "zod";
import { StudentService } from "../../../application/studentService.ts";
import {
    StudentCourseSchema,
    StudentIdSchema,
    StudentOpenInstallmentSchema,
} from "../../../domain/student.ts";
import { toolError, toolSuccess } from "./toolResponse.ts";

// tools for the records under /alunos/id/{id_aluno}: they all need the id_aluno, which can be found with find_student or list_students



export function registerListStudentCoursesTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "list_student_courses",
        {
            description: "List the courses (packages) a student is enrolled in, by id_aluno",
            inputSchema: StudentIdSchema.shape,
            outputSchema: {
                id_aluno: z.number().describe('ID of the student'),
                courses: z.array(
                    StudentCourseSchema
                ).describe('Courses of the student')
            }
        },
        async ({ id_aluno }) => {
            try {
                const { cursos: courses } = await service.listStudentCourses(id_aluno)
                return toolSuccess(courses, { id_aluno, courses })
            } catch (error) {
                return toolError(`list courses of student ${id_aluno}`, error)
            }
        }
    )
}

export function registerListStudentOpenInstallmentsTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "list_student_open_installments",
        {
            description: "List the open (unpaid) installments of a student, by id_aluno, with the total amount due",
            inputSchema: StudentIdSchema.shape,
            outputSchema: {
                id_aluno: z.number().describe('ID of the student'),
                total: z.number().describe('Total of open installments'),
                valor_total: z.number().describe('Sum of the amounts due'),
                installments: z.array(
                    StudentOpenInstallmentSchema
                ).describe('Open installments of the student')
            }
        },
        async ({ id_aluno }) => {
            try {
                const { parcelas: installments } = await service.listStudentOpenInstallments(id_aluno)
                const valor_total = installments.reduce((sum, installment) => sum + installment.valor, 0)
                return toolSuccess(installments, { id_aluno, total: installments.length, valor_total, installments })
            } catch (error) {
                return toolError(`list open installments of student ${id_aluno}`, error)
            }
        }
    )
}

export function registerListStudentAttendanceTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "list_student_attendance",
        {
            description: "List the attendance records (presences and absences) of a student, by id_aluno",
            inputSchema: StudentIdSchema.shape,
            outputSchema: {
                id_aluno: z.number().describe('ID of the student'),
                total_registros: z.number().describe('Total of attendance records'),
                total_presenca: z.number().describe('Total of presences'),
                total_falta: z.number().describe('Total of absences'),
                attendance: z.array(z.record(z.unknown())).describe('Attendance records of the student')
            }
        },
        async ({ id_aluno }) => {
            try {
                const { total_registros, total_presenca, total_falta, presencas: attendance } = await service.listStudentAttendance(id_aluno)
                const result = { id_aluno, total_registros, total_presenca, total_falta, attendance }
                return toolSuccess(result, result)
            } catch (error) {
                return toolError(`list attendance of student ${id_aluno}`, error)
            }
        }
    )
}

export function registerListStudentExamsTool(
    server: McpServer,
    service: StudentService
) {

    server.registerTool(
        "list_student_exams",
        {
            description: "List the exams (provas) of a student, by id_aluno",
            inputSchema: StudentIdSchema.shape,
            outputSchema: {
                id_aluno: z.number().describe('ID of the student'),
                total: z.number().describe('Total of exams'),
                exams: z.array(z.record(z.unknown())).describe('Exams of the student')
            }
        },
        async ({ id_aluno }) => {
            try {
                const { total_provas: total, provas: exams } = await service.listStudentExams(id_aluno)
                return toolSuccess(exams, { id_aluno, total, exams })
            } catch (error) {
                return toolError(`list exams of student ${id_aluno}`, error)
            }
        }
    )
}
