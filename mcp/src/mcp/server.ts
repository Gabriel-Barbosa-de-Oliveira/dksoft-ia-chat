import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PackageService } from "../application/packageService.ts";
import { ReceivableAccountService } from "../application/receivableAccountService.ts";
import { PaidBillsService } from "../application/paidBillsService.ts";
import { registerListPackagesTool } from "./tools/packages/listPackages.ts";
import { registerListReceivableAccountsTool } from "./tools/receivable-accounts/receivableAccounts.ts";
import { registerPackageApiInfoResource } from "./resources/packagesApiInfo.ts";
import { registerFindPackagePrompt } from "./prompts/findPackages.ts";
import { registerReceivableAccountApiInfoResource } from "./resources/receivableAccountApiInfo.ts";
import { registerFindReceivableAccountsPrompt } from "./prompts/findReceivableAccounts.ts";
import { registerListPaidBillsTool } from "./tools/paid-bills/paidBills.ts";
import { registerFindPaidBillsPrompt } from "./prompts/findPaidBills.ts";
import { registerPaidBillsApiInfoResource } from "./resources/paidBillsApiInfo.ts";
import { StudentService } from "../application/studentService.ts";
import { registerListStudentsTool } from "./tools/students/listStudents.ts";
import { registerFindStudentTool, registerFindStudentsByPhoneTool } from "./tools/students/findStudent.ts";
import {
    registerListStudentAttendanceTool,
    registerListStudentCoursesTool,
    registerListStudentExamsTool,
    registerListStudentOpenInstallmentsTool,
} from "./tools/students/studentRecords.ts";
import { registerStudentsApiInfoResource } from "./resources/studentsApiInfo.ts";
import { registerFindStudentsPrompt } from "./prompts/findStudents.ts";

const BASE_URL = process.env.BASE_URL
if (!BASE_URL) {
    throw new Error("BASE_URL environment variable is not set")
}

const packageService = new PackageService(BASE_URL)
const receivableAccountService = new ReceivableAccountService(BASE_URL)
const paidBillsService = new PaidBillsService(BASE_URL)
const studentService = new StudentService(BASE_URL)
console.error(BASE_URL, "Base Url Configured")
export const server = new McpServer({
    name: "dksoft-mcp",
    version: "0.0.1",
});

registerListPackagesTool(server, packageService)
registerListReceivableAccountsTool(server, receivableAccountService)
registerListPaidBillsTool(server, paidBillsService)
registerListStudentsTool(server, studentService)
registerFindStudentTool(server, studentService)
registerFindStudentsByPhoneTool(server, studentService)
registerListStudentCoursesTool(server, studentService)
registerListStudentOpenInstallmentsTool(server, studentService)
registerListStudentAttendanceTool(server, studentService)
registerListStudentExamsTool(server, studentService)
registerPackageApiInfoResource(server, BASE_URL)
registerReceivableAccountApiInfoResource(server, BASE_URL)
registerPaidBillsApiInfoResource(server, BASE_URL)
registerStudentsApiInfoResource(server, BASE_URL)
registerFindPackagePrompt(server)
registerFindReceivableAccountsPrompt(server)
registerFindPaidBillsPrompt(server)
registerFindStudentsPrompt(server)
