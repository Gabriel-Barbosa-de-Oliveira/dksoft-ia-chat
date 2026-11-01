import type { Announcer } from "./useAnnouncer.ts";
import type { ExportApi } from "./ExportContext.tsx";
import type { UserError } from "../lib/errors.ts";
import { toUserErrorFrom } from "../lib/failures.ts";
import type { FileDescriptor, FileFormat } from "../lib/file-descriptor.ts";

export interface RunExportDeps {
  api: ExportApi;
  announcer: Announcer;
  turnKey: string;
  resultId: string;
  format: FileFormat;
  /** Só enviado quando a pessoa marcou "Incluir gráfico". */
  chartId?: string | null;
}

export type RunExportResult = { ok: true; file: FileDescriptor } | { ok: false; error: UserError };

/** Pede o arquivo, anexa ao turno e anuncia o resultado. Não é React. */
export async function runExport(deps: RunExportDeps): Promise<RunExportResult> {
  const { api, announcer, turnKey, resultId, format, chartId } = deps;
  try {
    const file = await api.request({ resultId, format, ...(chartId ? { chartId } : {}) });
    api.attach(turnKey, file);
    announcer.announce(`Arquivo pronto: ${file.name}.`);
    return { ok: true, file };
  } catch (cause) {
    const error = toUserErrorFrom(cause, "export");
    announcer.alert(`${error.title}. ${error.message}`);
    return { ok: false, error };
  }
}
