export interface SseFrame {
  event: string;
  data: string;
}

function parseBlock(block: string): SseFrame | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    const i = line.indexOf(":");
    const field = i === -1 ? line : line.slice(0, i);
    let value = i === -1 ? "" : line.slice(i + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length > 0 ? { event, data: data.join("\n") } : null;
}

/** Decodificador SSE incremental: tolera quadros partidos, `\r\n`, comentários e campos desconhecidos. */
export function createSseDecoder() {
  let buffer = "";
  return {
    feed(chunk: string): SseFrame[] {
      buffer += chunk;
      // Um "\r" final pode ser o começo de "\r\n": fica retido até o próximo pedaço.
      const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r(?!$)/g, "\n");
      const blocks = normalized.split("\n\n");
      buffer = blocks.pop() ?? "";
      const frames: SseFrame[] = [];
      for (const block of blocks) {
        const frame = parseBlock(block);
        if (frame) frames.push(frame);
      }
      return frames;
    },
    /** Fim do corpo: o quadro incompleto é descartado. */
    flush(): SseFrame[] {
      buffer = "";
      return [];
    },
  };
}
