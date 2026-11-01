import { z } from "zod";
import type { ApiClient } from "./client.ts";
import { FileDescriptorSchema, type FileDescriptor } from "../lib/file-descriptor.ts";

/** Baixa o arquivo com a chave no cabeçalho (nunca na URL) e devolve o conteúdo como `Blob`. */
export async function downloadFile(client: ApiClient, file: Pick<FileDescriptor, "downloadPath" | "mime">): Promise<Blob> {
  const response = await client.open(file.downloadPath, { method: "GET" });
  const blob = await response.blob();
  return blob.type === "" ? new Blob([blob], { type: file.mime }) : blob;
}

/** Entrega o `Blob` ao navegador por um `<a download>` temporário; a URL é revogada em seguida. */
export function saveBlob(blob: Blob, name: string, doc: Document = document, urls: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL): void {
  const url = urls.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => urls.revokeObjectURL(url), 0);
}

export type ExportFormat = FileDescriptor["format"];

export interface ExportRequestInput {
  conversationId: string;
  resultId: string;
  format: ExportFormat;
  chartId?: string;
}

const ExportResponseSchema = z.object({ requestId: z.string(), file: FileDescriptorSchema });

/** Pede o arquivo pelo botão. Sempre mascarado: o corpo não tem opção de dados completos. */
export async function requestExport(client: ApiClient, input: ExportRequestInput): Promise<FileDescriptor> {
  const body: Record<string, string> = { conversationId: input.conversationId, resultId: input.resultId, format: input.format };
  if (input.chartId) body.chartId = input.chartId;
  const response = await client.request("/exports", ExportResponseSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.file;
}
