import type { ErrorInput } from "./errors.ts";

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
