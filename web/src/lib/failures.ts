import { toUserError, type ErrorContext, type ErrorInput, type UserError } from "./errors.ts";

/** Falha da API ou do cliente, pronta para virar `UserError` na borda. */
export class ApiFailure extends Error {
  readonly input: ErrorInput;
  constructor(input: ErrorInput) {
    super(`api_failure:${input.source}`);
    this.name = "ApiFailure";
    this.input = input;
  }
}

/** Resposta ou evento conhecido cujo corpo não casa com o schema. */
export class UnexpectedResponseError extends Error {
  constructor(detail: string) {
    super(`unexpected_response:${detail}`);
    this.name = "UnexpectedResponseError";
  }
}

/** Qualquer exceção → `UserError`. Falhas desconhecidas viram `unexpected_response` (nunca texto cru). */
export function toUserErrorFrom(error: unknown, context: ErrorContext = "session"): UserError {
  if (error instanceof ApiFailure) return toUserError(error.input, context);
  return toUserError({ source: "client", kind: "unexpected_response" }, context);
}
