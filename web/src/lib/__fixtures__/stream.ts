export const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
export const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";

export function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

export const META = { requestId: REQUEST_ID, conversationId: CONVERSATION_ID };
export const TOOL_LABEL = "Buscando o aluno pela matrícula…";

export const metaFrame = frame("meta", META);
export const toolStartFrame = frame("tool", { phase: "start", name: "dksoft_find_student", label: TOOL_LABEL });
export const toolEndFrame = frame("tool", { phase: "end", name: "dksoft_find_student", label: TOOL_LABEL, ok: true });
export const tokenFrames = ["O aluno ", "está ", "ativo."].map((text) => frame("token", { text }));
export const doneData = { ...META, model: "modelo-teste", durationMs: 4210, partial: false };
export const doneFrame = frame("done", doneData);
export const donePartialFrame = frame("done", { ...doneData, partial: true });

export const streamOk = [metaFrame, toolStartFrame, toolEndFrame, ...tokenFrames, doneFrame].join("");
export const streamOkCrlf = streamOk.replace(/\n/g, "\r\n");
export const streamDonePartial = [metaFrame, ...tokenFrames, donePartialFrame].join("");
export const streamNoTerminal = [metaFrame, toolStartFrame, tokenFrames[0]!].join("");
export const streamUnknownEvent = [metaFrame, frame("novidade", { x: 1 }), tokenFrames[0]!, doneFrame].join("");
export const streamBadData = [metaFrame, frame("token", { texto: 1 }), doneFrame].join("");

export const errorCodes = ["timeout", "model_unavailable", "tools_unavailable", "internal_error"] as const;
export function streamError(code: (typeof errorCodes)[number]): string {
  return [metaFrame, tokenFrames[0]!, frame("error", { requestId: REQUEST_ID, code, message: "texto cru do servidor" })].join("");
}

/** Parte o texto em pedaços de `size` unidades, para testar quadros partidos. */
export function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}
