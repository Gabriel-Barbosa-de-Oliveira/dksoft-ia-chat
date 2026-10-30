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
] as const;
export type Scenario = (typeof SCENARIOS)[number];

interface StoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
interface Conversation {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
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
    const conversationId = conversation?.id ?? randomUUID();
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

    switch (scenario) {
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
    if (!conversation) {
      conversation = { id: conversationId, createdAt: now, updatedAt: now, messages: [] };
      conversations.set(conversation.id, conversation);
    }
    conversation.messages.push(
      { id: nextMessageId++, role: "user", content: body.message.trim(), createdAt: now },
      { id: nextMessageId++, role: "assistant", content: answer, createdAt: now },
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
