import { createContext, useContext } from "react";
import type { FileDescriptor } from "../lib/file-descriptor.ts";
import type { ExportRequestInput } from "../api/exports.ts";

/** Operações de arquivo que os componentes usam; o dono da conversa fornece a implementação com o cliente da API. */
export interface ExportApi {
  conversationId: string | null;
  /** Baixa e entrega o arquivo ao navegador. Lança `ApiFailure` em caso de falha. */
  download(file: FileDescriptor): Promise<void>;
  /** Pede um arquivo novo (sempre mascarado). Lança `ApiFailure` em caso de falha. */
  request(input: Omit<ExportRequestInput, "conversationId">): Promise<FileDescriptor>;
  /** Coloca o arquivo gerado pelo botão no turno de origem. */
  attach(turnKey: string, file: FileDescriptor): void;
}

export const ExportContext = createContext<ExportApi | null>(null);

export function useExportApi(): ExportApi | null {
  return useContext(ExportContext);
}
