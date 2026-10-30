export function joinTokens(buffer: readonly string[]): string {
  return buffer.join("");
}

export interface TokenBuffer {
  push(text: string): void;
  /** Devolve tudo o que foi acumulado e esvazia o buffer. */
  drain(): string;
  readonly size: number;
}

export function createTokenBuffer(): TokenBuffer {
  let parts: string[] = [];
  return {
    push(text) {
      parts.push(text);
    },
    drain() {
      const out = joinTokens(parts);
      parts = [];
      return out;
    },
    get size() {
      return parts.length;
    },
  };
}
