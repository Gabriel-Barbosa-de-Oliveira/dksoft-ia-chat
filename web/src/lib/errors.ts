import type { ApiErrorBody, StreamErrorCode } from "./events.ts";

export type ErrorKind =
  | "unauthorized"
  | "origin_not_allowed"
  | "conversation_not_found"
  | "rate_limited"
  | "invalid_body"
  | "timeout"
  | "model_unavailable"
  | "tools_unavailable"
  | "server_error"
  | "network"
  | "connection_lost"
  | "client_timeout"
  | "unexpected_response";

export type ErrorAction = "retry" | "reauthenticate" | "new-conversation" | "wait" | "none";

export interface UserError {
  kind: ErrorKind;
  title: string;
  message: string;
  action: ErrorAction;
  retryAfterSeconds: number | null;
  supportCode: string | null;
}

export type ErrorInput =
  | { source: "http"; status: number; body: ApiErrorBody | null }
  | { source: "stream"; code: StreamErrorCode; requestId: string | null }
  | { source: "client"; kind: "connection_lost" | "client_timeout" | "unexpected_response" | "conversation_not_found"; requestId?: string | null }
  | { source: "network" };

export type ErrorContext = "gate" | "session";

const DEFAULT_RETRY_AFTER = 60;

type Texts = { title: string; message: string; action: ErrorAction };

const TEXTS: Record<Exclude<ErrorKind, "unauthorized" | "rate_limited">, Texts> = {
  origin_not_allowed: {
    title: "Endereço não autorizado",
    message:
      "Este endereço não tem permissão para usar o chat. Fale com a equipe da DKSOFT e informe o código de suporte.",
    action: "none",
  },
  conversation_not_found: {
    title: "Conversa não encontrada",
    message: "Esta conversa não existe mais ou o endereço está incorreto.",
    action: "new-conversation",
  },
  invalid_body: {
    title: "Pergunta não enviada",
    message: "O texto não pôde ser enviado. Revise a pergunta e tente de novo.",
    action: "none",
  },
  timeout: {
    title: "A resposta demorou demais",
    message: "A pergunta passou do tempo máximo. Tente de novo ou simplifique o pedido.",
    action: "retry",
  },
  model_unavailable: {
    title: "Assistente indisponível",
    message: "O assistente de IA está indisponível agora. Tente novamente em instantes.",
    action: "retry",
  },
  tools_unavailable: {
    title: "Não foi possível consultar os dados",
    message: "Não consegui consultar os dados da escola agora. Tente novamente em instantes.",
    action: "retry",
  },
  server_error: {
    title: "Algo deu errado",
    message: "Ocorreu um erro inesperado do nosso lado. Tente novamente.",
    action: "retry",
  },
  network: {
    title: "Sem conexão",
    message: "Não foi possível falar com o servidor. Verifique a sua internet e tente de novo.",
    action: "retry",
  },
  connection_lost: {
    title: "Conexão interrompida",
    message: "A conexão caiu antes do fim da resposta. O texto recebido até aqui está acima.",
    action: "retry",
  },
  client_timeout: {
    title: "A resposta está demorando demais",
    message: "Não recebi o fim da resposta a tempo. Tente de novo.",
    action: "retry",
  },
  unexpected_response: {
    title: "Resposta inesperada",
    message:
      "O servidor respondeu de um jeito que a interface não entende. Tente de novo; se persistir, informe o código de suporte.",
    action: "retry",
  },
};

function make(kind: ErrorKind, texts: Texts, supportCode: string | null, retryAfterSeconds: number | null = null): UserError {
  return { kind, ...texts, retryAfterSeconds, supportCode };
}

function fromKind(kind: keyof typeof TEXTS, supportCode: string | null): UserError {
  return make(kind, TEXTS[kind], supportCode);
}

function unauthorized(context: ErrorContext, supportCode: string | null): UserError {
  if (context === "gate") {
    return make(
      "unauthorized",
      { title: "Chave incorreta", message: "A chave informada não foi aceita. Confira e tente de novo.", action: "none" },
      supportCode,
    );
  }
  return make(
    "unauthorized",
    {
      title: "Sua sessão expirou",
      message: "Informe a chave de acesso de novo para continuar. A sua pergunta foi mantida.",
      action: "reauthenticate",
    },
    supportCode,
  );
}

function rateLimited(seconds: number, supportCode: string | null): UserError {
  return make(
    "rate_limited",
    {
      title: "Muitas perguntas em pouco tempo",
      message: `Aguarde ${seconds} s para enviar de novo. A sua pergunta foi mantida.`,
      action: "wait",
    },
    supportCode,
    seconds,
  );
}

/** Traduz qualquer falha em texto da própria interface; nunca repassa texto cru do servidor. */
export function toUserError(input: ErrorInput, context: ErrorContext = "session"): UserError {
  switch (input.source) {
    case "network":
      return fromKind("network", null);
    case "client":
      return fromKind(input.kind, input.requestId ?? null);
    case "stream":
      return input.code === "internal_error"
        ? fromKind("server_error", input.requestId)
        : fromKind(input.code, input.requestId);
    case "http": {
      const { body } = input;
      if (!body) return fromKind("unexpected_response", null);
      const support = body.requestId;
      switch (body.error) {
        case "unauthorized":
          return unauthorized(context, support);
        case "origin_not_allowed":
          return fromKind("origin_not_allowed", support);
        case "conversation_not_found":
          return fromKind("conversation_not_found", support);
        case "rate_limited":
          return rateLimited(body.retryAfterSeconds ?? DEFAULT_RETRY_AFTER, support);
        case "invalid_body":
          return fromKind("invalid_body", support);
        case "internal_error":
          return fromKind("server_error", support);
      }
    }
  }
}
