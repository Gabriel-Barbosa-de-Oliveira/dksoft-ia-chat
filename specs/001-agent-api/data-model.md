# Data Model: API do Agente de Chat

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Entidades da spec (Conversa, Mensagem, Pergunta/requisição, Evento de resposta, Consulta) mapeadas para tabelas e tipos. IDs de conversa e de requisição são UUID v4 gerados no servidor.

## Tabelas (SQLite)

### `conversations`

| Coluna | Tipo | Regra |
|--------|------|-------|
| `id` | TEXT PK | UUID v4 |
| `created_at` | TEXT NOT NULL | ISO 8601 UTC |
| `updated_at` | TEXT NOT NULL | ISO 8601 UTC; atualizado a cada par gravado |

### `messages`

| Coluna | Tipo | Regra |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | Define a ordem |
| `conversation_id` | TEXT NOT NULL | FK → `conversations.id` |
| `role` | TEXT NOT NULL | `CHECK (role IN ('user','assistant'))` |
| `content` | TEXT NOT NULL | Texto em claro (contexto da conversa) |
| `created_at` | TEXT NOT NULL | ISO 8601 UTC |

Índice: `(conversation_id, id)`. Só entram a pergunta da pessoa e o texto final do assistente, **gravados juntos, em uma transação, após a conclusão** da execução. Mensagens de tool não são persistidas.

### `runs`

Uma linha por pergunta (FR-018). **Nunca contém texto da pergunta nem dados pessoais.**

| Coluna | Tipo | Regra |
|--------|------|-------|
| `request_id` | TEXT PK | UUID v4, o mesmo de `X-Request-Id` |
| `conversation_id` | TEXT NULL | Nula se a execução falhou antes de existir conversa |
| `started_at` | TEXT NOT NULL | ISO 8601 UTC |
| `duration_ms` | INTEGER NOT NULL | ≥ 0 |
| `outcome` | TEXT NOT NULL | `CHECK (outcome IN ('ok','error','timeout','aborted'))` |
| `model_used` | TEXT NULL | Principal ou reserva; nula se nenhum respondeu |
| `tool_calls` | INTEGER NOT NULL | Quantidade de invocações de tool |
| `error_type` | TEXT NULL | Nome da classe de erro, já passado por `maskPii` |

Índice: `(started_at)`.

## Ciclo de vida de uma execução (`Run`)

```text
recebida ──► validada ──► em andamento ──► ok
   │             │             ├──────────► error     (modelo/tools/interno)
   │             │             ├──────────► timeout   (CHAT_TIMEOUT_MS)
   │             │             └──────────► aborted   (conexão fechada pela pessoa)
   └─ 401/400/404 antes do stream: resposta JSON, sem linha em `runs`
```

Só execuções que chegam a "em andamento" geram linha em `runs`. Em `ok`, o par de mensagens é gravado; nos demais, nada é gravado em `messages`.

## Tipos de domínio (zod)

### `ChatRequest` (corpo do `POST /chat`)

| Campo | Regra |
|-------|-------|
| `message` | string, `trim()` não vazio, 1–4000 caracteres |
| `conversationId` | UUID opcional; se presente, a conversa precisa existir |

### `StreamEvent` (união discriminada por `event`)

| `event` | `data` | Quando |
|---------|--------|--------|
| `meta` | `{ requestId, conversationId }` | Primeiro evento |
| `tool` | `{ phase: "start" \| "end", name, label, ok? }` | Início e fim de cada consulta |
| `token` | `{ text }` | Cada pedaço de texto da resposta |
| `done` | `{ requestId, conversationId, model, durationMs, partial }` | Fim com sucesso; `partial` = algum resultado foi cortado |
| `error` | `{ requestId, code, message }` | Fim com falha (terminal) |

Códigos de erro do stream: `timeout`, `model_unavailable`, `tools_unavailable`, `internal_error`.

### `ToolResultSummary` (saída de `shapeToolResult`)

| Campo | Regra |
|-------|-------|
| `total` | Quantidade de registros devolvidos pela consulta (exata) |
| `somas` | Mapa campo → soma exata, só para campos monetários conhecidos (`valor_pago`, `valor`) |
| `registros` | Primeiras N linhas (padrão 40), JSON compacto |
| `truncado` | `true` quando houve corte por linhas ou por tamanho |
| `omitidos` | Quantidade de linhas fora de `registros` |

### `PeriodWindow` (saída de `splitPeriod`)

`{ inicio: "AAAA-MM-DD", fim: "AAAA-MM-DD" }`, janelas consecutivas **inclusivas** de até 30 dias, sem sobreposição nem buraco. Total máximo de 90 dias; acima disso, `PeriodTooLongError`. Datas inválidas ou invertidas são erro de entrada.

### `AppConfig` (saída de `loadConfig`)

| Variável | Regra | Padrão |
|----------|-------|--------|
| `OPENROUTER_API_KEY` | obrigatória | — |
| `OPENROUTER_MODEL` | obrigatória | — |
| `OPENROUTER_MODEL_FALLBACK` | vazia ou igual ao principal = sem reserva | — |
| `API_TOKEN` | obrigatória | — |
| `BASE_URL` | URL terminada em `/api/v1` | — |
| `CHAT_ACCESS_KEY` | mínimo 32 caracteres | — |
| `CHAT_CORS_ORIGINS` | lista separada por vírgula, comparação exata | `http://localhost:5173` |
| `CHAT_DB` | caminho do SQLite | `./data/chat.db` |
| `PORT` | inteiro | `3000` |
| `CHAT_TIMEOUT_MS` | inteiro > 0 | `120000` |
| `CHAT_HISTORY_LIMIT` | inteiro ≥ 1 | `12` |
| `DKSOFT_MAX_CONCURRENCY` | inteiro 1–5 | `4` |
| `DKSOFT_MAX_PER_MINUTE` | inteiro 1–60 | `50` |
| `TOOL_RESULT_MAX_ROWS` | inteiro ≥ 1 | `40` |
| `CHAT_RATE_LIMIT_PER_MIN` | inteiro ≥ 1; limite por IP em `POST /chat` | `30` |
| `MCP_ENTRY` | caminho do `index.ts` do MCP que o `api/` sobe por stdio | `../mcp/src/index.ts` (relativo a `api/`) |

## Relacionamentos

```text
conversations 1 ──── * messages
conversations 1 ──── * runs      (conversation_id pode ser nula em runs)
```

Conversas são isoladas: toda leitura de `messages` filtra por `conversation_id`, e o agente só recebe as mensagens da conversa informada (FR-007).

## Fora do modelo (por decisão)

Usuário, tenant, perfil, token por cliente, memória de longo prazo e resumo de conversa não existem nesta spec (constitution, princípio IX).
