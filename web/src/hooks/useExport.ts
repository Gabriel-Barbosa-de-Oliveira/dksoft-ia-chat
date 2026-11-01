import { useCallback, useRef, useState } from "react";
import type { UserError } from "../lib/errors.ts";
import type { FileFormat } from "../lib/file-descriptor.ts";
import { useAnnouncer } from "./useAnnouncer.ts";
import type { ExportApi } from "./ExportContext.tsx";
import { runExport } from "./run-export.ts";

export type ExportRequestState =
  | { status: "idle" }
  | { status: "generating"; format: FileFormat }
  | { status: "error"; error: UserError };

export interface UseExport {
  state: ExportRequestState;
  /** Pede o arquivo. Ignorado enquanto outro pedido do mesmo turno está em andamento. */
  run(format: FileFormat, chartId?: string | null): Promise<void>;
  /** Repete o último pedido (botão "Tentar de novo"). */
  retry(): Promise<void>;
  clear(): void;
}

export function useExport(options: { api: ExportApi | null; turnKey: string; resultId: string }): UseExport {
  const { api, turnKey, resultId } = options;
  const announcer = useAnnouncer();
  const [state, setState] = useState<ExportRequestState>({ status: "idle" });
  const inFlight = useRef(false);
  const last = useRef<{ format: FileFormat; chartId?: string | null } | null>(null);

  const run = useCallback(
    async (format: FileFormat, chartId?: string | null) => {
      if (!api || inFlight.current) return;
      inFlight.current = true;
      last.current = { format, chartId };
      setState({ status: "generating", format });
      const result = await runExport({ api, announcer, turnKey, resultId, format, chartId });
      inFlight.current = false;
      setState(result.ok ? { status: "idle" } : { status: "error", error: result.error });
    },
    [api, announcer, turnKey, resultId],
  );

  const retry = useCallback(async () => {
    if (last.current) await run(last.current.format, last.current.chartId);
  }, [run]);

  const clear = useCallback(() => setState({ status: "idle" }), []);

  return { state, run, retry, clear };
}
