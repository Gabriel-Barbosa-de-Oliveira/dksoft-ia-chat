import {
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
        return this.get<StudentsResponse>(`/alunos?${params}`)
    }

    async findStudent(campo: StudentLookupField, valor: string): Promise<StudentDetailResponse> {
        return this.get<StudentDetailResponse>(`/alunos/${campo}/${encodeURIComponent(valor)}`)
    }

    async findStudentsByPhone(telefone: string): Promise<StudentsByPhoneResponse> {
        return this.get<StudentsByPhoneResponse>(`/alunos/telefone/${encodeURIComponent(telefone)}`)
    }

    async listStudentCourses(idAluno: number): Promise<StudentCoursesResponse> {
        return this.get<StudentCoursesResponse>(`/alunos/id/${idAluno}/cursos`)
    }

    async listStudentOpenInstallments(idAluno: number): Promise<StudentOpenInstallmentsResponse> {
        return this.get<StudentOpenInstallmentsResponse>(`/alunos/id/${idAluno}/parcelas-abertas`)
    }

    async listStudentAttendance(idAluno: number): Promise<StudentAttendanceResponse> {
        return this.get<StudentAttendanceResponse>(`/alunos/id/${idAluno}/presencas`)
    }

    async listStudentExams(idAluno: number): Promise<StudentExamsResponse> {
        return this.get<StudentExamsResponse>(`/alunos/id/${idAluno}/provas`)
    }

    // the API answers 404 with an html body when the student does not exist, so the body is only parsed on success
    private async get<T>(path: string): Promise<T> {
        const res = await this.fetch(`${this.baseUrl}${path}`)
        if (!res.ok) {
            const body = await res.text()
            let message = body
            try {
                message = (JSON.parse(body) as { mensagem?: string }).mensagem ?? body
            } catch {
                // keep the raw body
            }
            throw new Error(res.status === 404 ? "Not found (404)" : `HTTP ${res.status}: ${message}`)
        }
        return res.json() as Promise<T>
    }
}
