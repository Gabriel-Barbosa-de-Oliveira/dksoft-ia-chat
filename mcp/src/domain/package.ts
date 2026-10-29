import z from "zod";

export const PackageModuleSchema = z.object({
    id_modulo: z.number().describe("ID of the module"),
    nome: z.string().describe("Name of the module"),
    sequencia: z.number().describe("Order of the module inside the package"),
    carga_horaria: z.number().nullable().optional().describe("Workload of the module in hours"),
})
export type PackageModule = z.infer<typeof PackageModuleSchema>

export const PackageSchema = z.object({
    id_pacote: z.number().describe("ID of the package"),
    nome: z.string().describe("Name of the package"),
    carga_horaria: z.number().nullable().optional().describe("Total workload of the package in hours"),
    modulos: z.array(PackageModuleSchema).describe("Modules that compose the package"),
})
export type Package = z.infer<typeof PackageSchema>

export const PackagesResponseSchema = z.object({
    status: z.string(),
    total: z.number(),
    pacotes: z.array(PackageSchema),
})
export type PackagesResponse = z.infer<typeof PackagesResponseSchema>


export const PackageQuerySchema = z.object({
    id_pacote: z.number().optional().describe("ID of the package"),
    nome: z.string().optional().describe("Name (or part of the name) of the package"),
})
export type PackageQuery = z.infer<typeof PackageQuerySchema>


export const PackageResultSchema = z.object({
    message: z.string().optional().describe("Confirmation message"),
    isError: z.boolean().optional().describe("Indicates if an error occurred"),
    total: z.number().optional().describe("Total of packages returned"),
    package: PackageSchema.optional().describe("The found package"),
    packages: z.array(PackageSchema).optional().describe("List of packages"),
})
export type PackageResult = z.infer<typeof PackageResultSchema>
