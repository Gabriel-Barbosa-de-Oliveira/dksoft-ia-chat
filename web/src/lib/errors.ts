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
  | "unexpected_response"
  | "file_not_found"
  | "result_not_found"
  | "nothing_to_export"
  | "export_too_large"
  | "export_busy"
  | "export_timeout"
  | "export_failed"
  | "download_failed";

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

export type ErrorContext = "gate" | "session" | "export" | "download";

const DEFAULT_RETRY_AFTER = 60;

type Texts = { title: string; message: string; action: ErrorAction };

const TEXTS: Record<Exclude<ErrorKind, "unauthorized" | "rate_limited" | "export_busy" | "export_too_large">, Texts> = {
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
  file_not_found: {
    title: "Arquivo indisponível",
    message: "Este arquivo não está mais disponível.",
    action: "none",
  },
  result_not_found: {
    title: "Dados indisponíveis",
    message: "Os dados dessa consulta não estão mais disponíveis para exportar. Refaça a pergunta e exporte em seguida.",
    action: "none",
  },
  nothing_to_export: {
    title: "Nada para exportar",
    message: "Essa consulta não trouxe registros, então não há o que exportar.",
    action: "none",
  },
  export_timeout: {
    title: "A geração demorou demais",
    message: "A geração do arquivo demorou mais que o esperado. Tente de novo ou reduza o período.",
    action: "retry",
  },
  download_failed: {
    title: "Não foi possível baixar",
    message: "Não foi possível baixar o arquivo. Verifique a conexão e tente de novo.",
    action: "retry",
  },
  export_failed: {
    title: "Não foi possível gerar o arquivo",
    message: "Não foi possível gerar o arquivo agora. Tente de novo.",
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

function exportBusy(seconds: number, supportCode: string | null): UserError {
  return make(
    "export_busy",
    {
      title: "Exportações em andamento",
      message: `Há outras exportações em andamento. Tente de novo em ${seconds} segundos.`,
      action: "wait",
    },
    supportCode,
    seconds,
  );
}

function exportTooLarge(rows: number | undefined, maxRows: number | undefined, supportCode: string | null): UserError {
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const message =
    rows !== undefined && maxRows !== undefined
      ? `Esse resultado tem ${fmt(rows)} linhas e o limite por arquivo é ${fmt(maxRows)}. Reduza o período ou use um filtro e tente de novo.`
      : "Esse resultado passa do limite de linhas por arquivo. Reduza o período ou use um filtro e tente de novo.";
  return make("export_too_large", { title: "Resultado grande demais", message, action: "none" }, supportCode);
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
      return fromKind(context === "download" ? "download_failed" : "network", null);
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
          return context === "export"
            ? exportBusy(body.retryAfterSeconds ?? DEFAULT_RETRY_AFTER, support)
            : rateLimited(body.retryAfterSeconds ?? DEFAULT_RETRY_AFTER, support);
        case "invalid_body":
          return fromKind("invalid_body", support);
        case "internal_error":
          return context === "export" ? fromKind("export_failed", support) : fromKind("server_error", support);
        case "file_not_found":
          return fromKind("file_not_found", support);
        case "result_not_found":
        case "chart_not_found":
          return fromKind("result_not_found", support);
        case "nothing_to_export":
          return fromKind("nothing_to_export", support);
        case "export_too_large":
          return exportTooLarge(body.rows, body.maxRows, support);
        case "export_busy":
          return exportBusy(body.retryAfterSeconds ?? DEFAULT_RETRY_AFTER, support);
        case "export_timeout":
          return fromKind("export_timeout", support);
      }
    }
  }
}
