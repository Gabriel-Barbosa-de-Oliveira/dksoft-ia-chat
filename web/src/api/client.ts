import type { ZodType } from "zod";
import { ApiErrorBodySchema } from "../lib/events.ts";
import { ApiFailure } from "../lib/failures.ts";

export interface ApiClientOptions {
  baseUrl: string;
  getKey: () => string | null;
  fetch: typeof fetch;
  /** Chamado quando a API responde 401 (chave recusada durante o uso). */
  onUnauthorized?: () => void;
}

export interface ApiClient {
  /** Faz a requisição e devolve a resposta `2xx`; qualquer outra coisa vira `ApiFailure`. */
  open(path: string, init?: RequestInit): Promise<Response>;
  /** `open` + corpo JSON validado por `schema`. */
  request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T>;
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/+$/, "");

  async function open(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const key = options.getKey();
    if (key) headers.set("Authorization", `Bearer ${key}`);

    let response: Response;
    try {
      response = await options.fetch(`${base}${path}`, { ...init, headers });
    } catch (error) {
      if (isAbort(error)) throw error;
      throw new ApiFailure({ source: "network" });
    }

    if (response.ok) return response;

    let body = null;
    try {
      const parsed = ApiErrorBodySchema.safeParse(await response.json());
      body = parsed.success ? parsed.data : null;
    } catch {
      body = null;
    }
    if (response.status === 401) options.onUnauthorized?.();
    throw new ApiFailure({ source: "http", status: response.status, body });
  }

  async function request<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
    const response = await open(path, init);
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new ApiFailure({ source: "client", kind: "unexpected_response" });
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new ApiFailure({ source: "client", kind: "unexpected_response" });
    return parsed.data;
  }

  return { open, request };
}
