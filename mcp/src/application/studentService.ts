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
import { StudentHttpClient } from "../infrastructure/studentHttpClient.ts";

export class StudentService {
    private readonly client: StudentHttpClient;

    constructor(baseUrl: string) {
        this.client = new StudentHttpClient(baseUrl);
    }

    async listStudents(query: StudentsQuery): Promise<StudentsResponse> {
        return await this.client.listStudents(query)
    }

    async findStudent(campo: StudentLookupField, valor: string): Promise<StudentDetailResponse> {
        return await this.client.findStudent(campo, valor)
    }

    async findStudentsByPhone(telefone: string): Promise<StudentsByPhoneResponse> {
        return await this.client.findStudentsByPhone(telefone)
    }

    async listStudentCourses(idAluno: number): Promise<StudentCoursesResponse> {
        return await this.client.listStudentCourses(idAluno)
    }

    async listStudentOpenInstallments(idAluno: number): Promise<StudentOpenInstallmentsResponse> {
        return await this.client.listStudentOpenInstallments(idAluno)
    }

    async listStudentAttendance(idAluno: number): Promise<StudentAttendanceResponse> {
        return await this.client.listStudentAttendance(idAluno)
    }

    async listStudentExams(idAluno: number): Promise<StudentExamsResponse> {
        return await this.client.listStudentExams(idAluno)
    }
}
