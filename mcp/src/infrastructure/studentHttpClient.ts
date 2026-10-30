import type z from "zod";
import {
    StudentAttendanceResponseSchema,
    StudentCoursesResponseSchema,
    StudentDetailResponseSchema,
    StudentExamsResponseSchema,
    StudentOpenInstallmentsResponseSchema,
    StudentsByPhoneResponseSchema,
    StudentsResponseSchema,
    type StudentAttendanceResponse,
    type StudentCoursesResponse,
    type StudentDetailResponse,
    type StudentExamsResponse,
    type StudentLookupField,
    type StudentOpenInstallmentsResponse,
    type StudentsByPhoneResponse,
    type StudentsQuery,
    type StudentsResponse,
} from "../domain/student.ts";
import { assertOk, parseResponse } from "./apiHttpError.ts";
import { withBearerToken, type FetchFn } from "./authInterceptor.ts";

export class StudentHttpClient {
    private baseUrl: string
    private readonly fetch: FetchFn
    constructor(baseUrl: string, fetchFn: FetchFn = withBearerToken()) {
        this.baseUrl = baseUrl
        this.fetch = fetchFn
    }


    async listStudents(query: StudentsQuery): Promise<StudentsResponse> {
        const params = new URLSearchParams({
            data_inicial: query.data_inicial,
            data_final: query.data_final,
        })
        if (query.limite !== undefined) params.set("limite", String(query.limite))
        if (query.offset !== undefined) params.set("offset", String(query.offset))
        return this.get(`/alunos?${params}`, StudentsResponseSchema)
    }

    async findStudent(campo: StudentLookupField, valor: string): Promise<StudentDetailResponse> {
        return this.get(`/alunos/${campo}/${encodeURIComponent(valor)}`, StudentDetailResponseSchema)
    }

    async findStudentsByPhone(telefone: string): Promise<StudentsByPhoneResponse> {
        return this.get(`/alunos/telefone/${encodeURIComponent(telefone)}`, StudentsByPhoneResponseSchema)
    }

    async listStudentCourses(idAluno: number): Promise<StudentCoursesResponse> {
        return this.get(`/alunos/id/${idAluno}/cursos`, StudentCoursesResponseSchema)
    }

    async listStudentOpenInstallments(idAluno: number): Promise<StudentOpenInstallmentsResponse> {
        return this.get(`/alunos/id/${idAluno}/parcelas-abertas`, StudentOpenInstallmentsResponseSchema)
    }

    async listStudentAttendance(idAluno: number): Promise<StudentAttendanceResponse> {
        return this.get(`/alunos/id/${idAluno}/presencas`, StudentAttendanceResponseSchema)
    }

    async listStudentExams(idAluno: number): Promise<StudentExamsResponse> {
        return this.get(`/alunos/id/${idAluno}/provas`, StudentExamsResponseSchema)
    }

    // the API answers 404 with an html body when the student does not exist, so the body is only parsed on success
    private async get<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
        const res = await this.fetch(`${this.baseUrl}${path}`)
        if (res.status === 404) throw new Error("Not found (404)")
        await assertOk(res)
        return parseResponse(schema, await res.json())
    }
}
