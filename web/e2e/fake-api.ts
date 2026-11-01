// Servidor falso do contrato HTTP da spec 001, usado só pelo E2E e para desenvolvimento manual.
// Fala exatamente o que o front consome (specs/002-chat-web-ui/contracts/api-consumption.md). Só `localhost`.
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { pathToFileURL } from "node:url";

export const TEST_KEY = "chave-de-teste-com-32-caracteres!!";

export const SCENARIOS = [
  "ok",
  "slow",
  "tool-fail",
  "partial",
  "markdown-table",
  "malicious-markdown",
  "error-timeout",
  "error-model",
  "error-tools",
  "error-internal",
  "cut",
  "rate-limited",
  "origin-denied",
  "server-500",
  "bad-body",
  "list-fail",
  // spec 004
  "export",
  "export-gone",
  "export-result-gone",
  "export-busy",
  "export-too-large",
  "chart",
] as const;
export type Scenario = (typeof SCENARIOS)[number];

interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  charts?: unknown[];
}
interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

/** Bytes de teste devolvidos pelo download (o front só os entrega ao navegador). */
export const FILE_BYTES = Buffer.from("%PDF-1.4 arquivo de teste\n", "utf8");

const uuid = () => randomUUID();

function chartSpec(type: "bar" | "line" | "pie", resultId: string) {
  const common = { id: uuid(), resultId, partial: false, subtitle: "01/10/2026 a 31/10/2026" };
  if (type === "bar")
    return {
      ...common, type, title: "Recebido por semana", valueKind: "currency", categories: ["Sem 1", "Sem 2", "Sem 3", "Sem 4"],
      series: [{ name: "Total recebido", values: [8200.5, 9100, 12300, 7050.25] }],
      summary: "Gráfico de barras com 4 semanas; maior valor R$ 12.300,00 na Sem 3.",
    };
  if (type === "line")
    return {
      ...common, type, title: "Matrículas por mês", valueKind: "integer", categories: ["Jul", "Ago", "Set", "Out"],
      series: [{ name: "Novas", values: [12, 18, 9, 22] }, { name: "Renovações", values: [30, 28, 35, 31] }],
      summary: "Gráfico de linhas com 2 séries em 4 meses; maior valor 35 em Set (Renovações).",
    };
  return {
    ...common, type, title: "Alunos por pacote", valueKind: "integer", categories: ["Básico", "Intensivo", "Premium"],
    series: [{ name: "Alunos", values: [40, 25, 15] }],
    summary: "Gráfico de pizza com 3 pacotes; Básico concentra 50% dos alunos.",
  };
}

export interface FakeApi {
  url: string;
  port: number;
  setScenario(name: Scenario): void;
  setKey(key: string): void;
  seed(count: number): void;
  requests: Array<{ method: string; path: string; auth: string | null }>;
  close(): Promise<void>;
}

const ORIGIN_OK = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`;
}

const TABLE = [
  "Veja os pacotes:",
  "",
  "| Pacote | Descrição | Valor mensal | Carga horária | Observação longa para forçar a rolagem horizontal da tabela |",
  "|---|---|---|---|---|",
  "| Básico | Aulas em grupo | R$ 199,00 | 20 h | Inclui material didático impresso e acesso à plataforma online por doze meses |",
  "| Intensivo | Aulas particulares | R$ 399,00 | 40 h | Inclui material didático impresso e acesso à plataforma online por doze meses |",
].join("\n");

const MALICIOUS =
  'Olá <script>window.__pwned=1</script><img src=x onerror="window.__pwned=2"> [clique](javascript:window.__pwned=3) fim.';

export async function startFakeApi(options: { port?: number; scenario?: Scenario; key?: string } = {}): Promise<FakeApi> {
  let scenario: Scenario = options.scenario ?? "ok";
  let key = options.key ?? TEST_KEY;
  const conversations = new Map<string, Conversation>();
  const requests: FakeApi["requests"] = [];
  let nextMessageId = 1;
  const files = new Map<string, { conversationId: string }>();

  function newFile(conversationId: string, resultId: string, format: "pdf" | "xlsx" | "docx", minutes = 30) {
    const id = uuid();
    files.set(id, { conversationId });
    const now = Date.now();
    return {
      id, conversationId, resultId, name: `contas-recebidas-20261031-213015.${format}`, format,
      mime: format === "pdf" ? "application/pdf" : "application/octet-stream", sizeBytes: 48211, rowCount: 312,
      includesChart: false, containsFullPersonalData: false,
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + minutes * 60_000).toISOString(),
      downloadPath: `/conversations/${conversationId}/exports/${id}`,
    };
  }

  function addConversation(question: string, answer: string, minutesAgo: number): Conversation {
    const at = new Date(Date.now() - minutesAgo * 60_000).toISOString();
    const conversation: Conversation = {
      id: randomUUID(),
      createdAt: at,
      updatedAt: at,
      messages: [
        { id: nextMessageId++, role: "user", content: question, createdAt: at },
        { id: nextMessageId++, role: "assistant", content: answer, createdAt: at },
      ],
    };
    conversations.set(conversation.id, conversation);
    return conversation;
  }

  function seed(count: number) {
    conversations.clear();
    for (let i = 0; i < count; i++) {
      addConversation(`Pergunta de exemplo número ${i + 1}: quais pacotes estão disponíveis?`, `Resposta **${i + 1}** do assistente.`, i * 90 + 5);
    }
  }
  seed(3);

  function cors(req: IncomingMessage): Record<string, string> {
    const origin = req.headers.origin;
    if (!origin || !ORIGIN_OK.test(origin)) return {};
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Expose-Headers": "X-Request-Id, X-Conversation-Id",
      Vary: "Origin",
    };
  }

  function json(req: IncomingMessage, res: ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { "Content-Type": "application/json", ...cors(req) });
    res.end(JSON.stringify(body));
  }

  const err = (req: IncomingMessage, res: ServerResponse, status: number, error: string, extra: object = {}) =>
    json(req, res, status, { requestId: randomUUID(), error, ...extra });

  async function readBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      return null;
    }
  }

  async function handleChat(req: IncomingMessage, res: ServerResponse) {
    if (scenario === "origin-denied") return err(req, res, 403, "origin_not_allowed");
    if (scenario === "server-500") return err(req, res, 500, "internal_error");
    if (scenario === "rate-limited") return err(req, res, 429, "rate_limited", { retryAfterSeconds: 3 });

    const body = (await readBody(req)) as { message?: unknown; conversationId?: unknown } | null;
    if (!body || typeof body.message !== "string" || body.message.trim() === "" || body.message.trim().length > 4000) {
      return err(req, res, 400, "invalid_body", { issues: [{ path: ["message"], message: "inválido" }] });
    }
    let conversation: Conversation | undefined;
    if (typeof body.conversationId === "string") {
      conversation = conversations.get(body.conversationId);
      if (!conversation) return err(req, res, 404, "conversation_not_found");
    }

    const requestId = randomUUID();
    // Como o backend real (chat.service): a conversa nasce no início; o par só é gravado no `done`.
    if (!conversation) {
      const now = new Date().toISOString();
      conversation = { id: randomUUID(), createdAt: now, updatedAt: now, messages: [] };
      conversations.set(conversation.id, conversation);
    }
    const conversationId = conversation.id;
    let closed = false;
    res.on("close", () => void (closed = true));
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...cors(req),
    });

    const send = (event: string, data: unknown) => {
      if (!closed) res.write(frame(event, data));
    };
    const delay = scenario === "slow" ? 300 : 15;
    const tokens = async (parts: string[]) => {
      for (const text of parts) {
        if (closed) return;
        send("token", { text });
        await sleep(delay);
      }
    };

    send("meta", { requestId, conversationId });
    await sleep(delay);

    if (scenario === "bad-body") {
      send("token", { texto: "formato errado" });
      return res.end();
    }

    const toolName = "dksoft_find_student";
    const label = "Buscando o aluno pela matrícula…";
    send("tool", { phase: "start", name: toolName, label });
    await sleep(delay);
    send("tool", { phase: "end", name: toolName, label, ok: scenario !== "tool-fail" });
    await sleep(delay);

    let answer = "";
    const say = async (parts: string[]) => {
      answer += parts.join("");
      await tokens(parts);
    };

    const charts: unknown[] = [];
    const resultId = uuid();
    const sendResult = () =>
      send("result", { resultId, label: "Contas recebidas, 01/10/2026 a 31/10/2026", rows: 312, totalRows: 312, capped: false, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

    switch (scenario) {
      case "export":
      case "export-gone":
      case "export-result-gone":
      case "export-busy":
      case "export-too-large":
        sendResult();
        await say(["Encontrei ", "312 ", "registros."]);
        if (scenario === "export" || scenario === "export-gone" || scenario === "export-result-gone") {
          send("file", { file: newFile(conversationId, resultId, "pdf") });
        }
        break;
      case "chart":
        sendResult();
        for (const type of ["bar", "line", "pie"] as const) {
          const chart = chartSpec(type, resultId);
          charts.push(chart);
          send("chart", { chart });
          await sleep(delay);
        }
        await say(["Veja ", "os ", "gráficos."]);
        break;
      case "markdown-table":
        await say(TABLE.split("\n").map((l) => `${l}\n`));
        break;
      case "malicious-markdown":
        await say([MALICIOUS]);
        break;
      case "slow":
        await say(Array.from({ length: 24 }, (_, i) => `palavra${i + 1} `));
        break;
      case "error-timeout":
      case "error-model":
      case "error-tools":
      case "error-internal": {
        await say(["Resultado ", "parcial "]);
        const code = { "error-timeout": "timeout", "error-model": "model_unavailable", "error-tools": "tools_unavailable", "error-internal": "internal_error" }[scenario];
        send("error", { requestId, code, message: "TEXTO CRU DO SERVIDOR" });
        return res.end();
      }
      case "cut":
        await say(["Resposta ", "cortada "]);
        return res.end(); // sem evento terminal
      default:
        await say(["O aluno ", "está ", "**ativo**."]);
    }

    if (closed) return; // "Parar": o par não é gravado (contrato 001)
    const now = new Date().toISOString();
    conversation.messages.push(
      { id: nextMessageId++, role: "user", content: body.message.trim(), createdAt: now },
      { id: nextMessageId++, role: "assistant", content: answer, createdAt: now, ...(charts.length > 0 ? { charts } : {}) },
    );
    conversation.updatedAt = now;
    send("done", { requestId, conversationId, model: "modelo-falso", durationMs: 123, partial: scenario === "partial" });
    res.end();
  }

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://fake");
    const auth = req.headers.authorization ?? null;
    requests.push({ method: req.method ?? "GET", path: url.pathname + url.search, auth });

    void (async () => {
      try {
        if (req.method === "OPTIONS") {
          res.writeHead(204, cors(req));
          return res.end();
        }

        // Controle do teste (sem autenticação).
        if (url.pathname === "/__scenario" && req.method === "POST") {
          const body = (await readBody(req)) as { name?: Scenario } | null;
          if (body?.name && (SCENARIOS as readonly string[]).includes(body.name)) scenario = body.name;
          return json(req, res, 200, { scenario });
        }
        if (url.pathname === "/__key" && req.method === "POST") {
          key = ((await readBody(req)) as { key?: string } | null)?.key ?? key;
          return json(req, res, 200, { ok: true });
        }
        if (url.pathname === "/__seed" && req.method === "POST") {
          seed(Number(((await readBody(req)) as { count?: number } | null)?.count ?? 3));
          return json(req, res, 200, { count: conversations.size });
        }

        if (auth !== `Bearer ${key}`) return err(req, res, 401, "unauthorized");

        if (url.pathname === "/conversations" && req.method === "GET") {
          const limit = Number(url.searchParams.get("limit") ?? 20);
          const offset = Number(url.searchParams.get("offset") ?? 0);
          if (scenario === "list-fail" && limit !== 1) return err(req, res, 500, "internal_error");
          const all = [...conversations.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          const page = all.slice(offset, offset + limit).map(({ id, createdAt, updatedAt }) => ({ id, createdAt, updatedAt }));
          return json(req, res, 200, { conversations: page, limit, offset });
        }

        const messages = /^\/conversations\/([^/]+)\/messages$/.exec(url.pathname);
        if (messages && req.method === "GET") {
          const conversation = conversations.get(decodeURIComponent(messages[1]!));
          if (!conversation) return err(req, res, 404, "conversation_not_found");
          return json(req, res, 200, { conversationId: conversation.id, messages: conversation.messages });
        }

        if (url.pathname === "/chat" && req.method === "POST") return await handleChat(req, res);

        const download = /^\/conversations\/([^/]+)\/exports\/([^/]+)$/.exec(url.pathname);
        if (download && req.method === "GET") {
          const found = files.get(download[2]!);
          if (scenario === "export-gone" || scenario === "export-result-gone" || !found || found.conversationId !== download[1]) {
            return err(req, res, 404, "file_not_found");
          }
          res.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": 'attachment; filename="contas.pdf"',
            "Content-Length": FILE_BYTES.byteLength,
            "Cache-Control": "no-store",
            ...cors(req),
          });
          return res.end(FILE_BYTES);
        }

        if (url.pathname === "/exports" && req.method === "POST") {
          const body = (await readBody(req)) as { conversationId?: string; resultId?: string; format?: "pdf" | "xlsx" | "docx"; chartId?: string } | null;
          if (!body?.conversationId || !body.resultId || !body.format) return err(req, res, 400, "invalid_body");
          if (scenario === "export-result-gone") return err(req, res, 404, "result_not_found");
          if (scenario === "export-busy") return err(req, res, 429, "export_busy", { retryAfterSeconds: 3 });
          if (scenario === "export-too-large") return err(req, res, 413, "export_too_large", { rows: 7000, maxRows: 5000 });
          return json(req, res, 201, { requestId: uuid(), file: { ...newFile(body.conversationId, body.resultId, body.format), includesChart: Boolean(body.chartId) } });
        }

        return err(req, res, 404, "conversation_not_found");
      } catch {
        if (!res.headersSent) err(req, res, 500, "internal_error");
        else res.end();
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, "127.0.0.1", resolve);
  });
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}`,
    port,
    requests,
    setScenario: (name) => void (scenario = name),
    setKey: (next) => void (key = next),
    seed,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

// Execução direta: `npm --prefix web run fake-api -- --scenario ok --port 3000`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1];
  };
  const scenario = (arg("scenario") ?? "ok") as Scenario;
  if (!(SCENARIOS as readonly string[]).includes(scenario)) {
    console.error(`Cenário desconhecido: ${scenario}. Disponíveis: ${SCENARIOS.join(", ")}`);
    process.exit(1);
  }
  const api = await startFakeApi({ port: Number(arg("port") ?? 3000), scenario });
  console.log(`API falsa em ${api.url} (cenário: ${scenario}). Chave de teste: ${TEST_KEY}`);
}
