# Data Model: Interface Web do Chat

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

O front não tem banco. Este documento descreve os tipos do domínio do cliente (`web/src/lib/`, puros, validados com zod na fronteira), a máquina de estados do turno, o que o navegador guarda e o que ele nunca guarda. As entidades da spec (Chave de acesso, Conversa, Mensagem, Resposta em andamento, Aviso de consulta, Erro apresentado, Preferência de tema, Rascunho) estão mapeadas abaixo. Os formatos de resposta da API vêm do [contrato da 001](../001-agent-api/contracts/http.md).

## Tipos validados na fronteira (zod)

Toda resposta e todo evento da API passam por um schema antes de virar estado (constitution, princípio II). Uma resposta que não casa com o schema vira o erro `unexpected_response`, nunca um valor parcial no estado.

| Tipo | Origem | Campos |
|------|--------|--------|
| `StreamEvent` | `POST /chat` (SSE) | União discriminada por `event`: `meta { requestId, conversationId }`, `tool { phase: "start" \| "end", name, label, ok? }`, `token { text }`, `done { requestId, conversationId, model: string \| null, durationMs, partial }`, `error { requestId, code, message }`. `code` ∈ `timeout`, `model_unavailable`, `tools_unavailable`, `internal_error` |
| `ApiErrorBody` | Erros HTTP antes do stream | `{ requestId: string, error: string, retryAfterSeconds?: number, conversationId?: string, issues?: unknown[] }`; `error` ∈ `invalid_body`, `unauthorized`, `origin_not_allowed`, `conversation_not_found`, `rate_limited`, `internal_error` |
| `ConversationSummary` | `GET /conversations` | `{ id: uuid, createdAt: ISO, updatedAt: ISO }` |
| `ConversationPage` | `GET /conversations` | `{ conversations: ConversationSummary[], limit: number, offset: number }` |
| `ChatMessage` | `GET /conversations/:id/messages` | `{ id: number, role: "user" \| "assistant", content: string, createdAt: ISO }` |
| `MessagesResponse` | idem | `{ conversationId: uuid, messages: ChatMessage[] }` |

`issues` e qualquer outro campo desconhecido são ignorados (`passthrough` desligado): o front não os exibe (FR-016).

## Entidades do cliente

### `Turn` (a "Resposta em andamento" da spec, mais a pergunta que a originou)

| Campo | Tipo | Regra |
|-------|------|-------|
| `key` | string | Identificador local do turno, estável durante a visita |
| `question` | string | Texto enviado (já com `trim`) |
| `status` | `TurnStatus` | Ver máquina de estados |
| `tools` | `ToolNotice[]` | Em ordem de chegada |
| `text` | string | Texto do assistente acumulado |
| `partial` | boolean | Vindo de `done.partial`; `false` até o `done` |
| `error` | `UserError \| null` | Preenchido em `error` |
| `requestId` | string \| null | De `meta`/`done`/corpo de erro; vira o código de suporte |
| `model` | string \| null | De `done.model` (informação de suporte, exibida discretamente) |

Turnos carregados do histórico entram com `status: "done"`, sem `tools` e `partial: false`; cada par `user` + `assistant` de `ChatMessage` vira um turno. Uma mensagem `user` sem `assistant` seguinte não ocorre no contrato (o par é gravado junto), mas, se ocorrer, vira turno `done` com texto vazio e não quebra a lista.

### `ToolNotice` (o "Aviso de consulta")

| Campo | Tipo | Regra |
|-------|------|-------|
| `name` | string | De `tool.name` |
| `label` | string | Texto legível vindo do servidor (`tool.label`), exibido como está |
| `phase` | `"running" \| "ok" \| "failed"` | `start` cria `running`; `end` com `ok !== false` → `ok`, `ok === false` → `failed` |

O `end` fecha o aviso `running` **mais antigo** com o mesmo `name` (consultas repetidas da mesma ferramenta se fecham na ordem). Um `end` sem `start` correspondente cria o aviso já fechado.

### `UserError` (o "Erro apresentado")

| Campo | Tipo | Regra |
|-------|------|-------|
| `kind` | string | Chave estável (`unauthorized`, `rate_limited`, `timeout`, `connection_lost`, …) |
| `title` | string | Frase curta em pt-BR |
| `message` | string | O que aconteceu e o que fazer, em pt-BR, **escrito no front** a partir de `kind` |
| `action` | `"retry" \| "reauthenticate" \| "new-conversation" \| "wait" \| "none"` | Ação principal oferecida |
| `retryAfterSeconds` | number \| null | Só em `rate_limited` |
| `supportCode` | string \| null | O `requestId`, quando existir; copiável |

A mensagem exibida nunca é o texto cru do servidor: `toUserError` ignora `message` do evento `error` e `issues` do `400`, e usa o texto do próprio front para cada código conhecido (FR-016). Tabela completa em [contracts/ui.md](./contracts/ui.md#mensagens-de-erro-pt-br).

### `ConversationView` (estado da conversa aberta)

| Campo | Tipo | Regra |
|-------|------|-------|
| `conversationId` | uuid \| null | `null` = conversa nova ainda sem pergunta enviada |
| `phase` | `"empty" \| "loading" \| "ready" \| "not-found" \| "error"` | `empty`: sem mensagens; `loading`: lendo histórico; `not-found`: id inexistente ou não UUID |
| `turns` | `Turn[]` | Em ordem |
| `loadError` | `UserError \| null` | Erro ao carregar histórico, isolado nesta seção |

Há **um** turno ativo (`working`/`streaming`) por conversa no máximo, e ele é sempre o último de `turns`.

### `ConversationListState` (painel de histórico)

| Campo | Tipo | Regra |
|-------|------|-------|
| `status` | `"loading" \| "ready" \| "empty" \| "error"` | `empty` = a API respondeu e não há conversas |
| `items` | `ConversationSummary[]` | Mais recente primeiro; páginas acrescentadas ao fim |
| `hasMore` | boolean | `true` quando a última página veio com `limit` itens |
| `loadingMore` | boolean | Carregando a página seguinte (o painel segue utilizável) |
| `error` | `UserError \| null` | Isolado no painel; "Tentar novamente" recarrega só ele |

`previews: Map<conversationId, string | null>` (cache em memória): o trecho da primeira pergunta, em até 60 caracteres, ou `null` quando a leitura falhou. Sem prévia, a lista mostra data e hora.

### Preferência de tema, Rascunho, Chave de acesso

| Entidade | Valores | Onde fica | Duração |
|----------|---------|-----------|---------|
| Chave de acesso | string (32+ caracteres) | `sessionStorage`, chave `dksoft.accessKey`; fallback em memória | Sessão do navegador |
| Preferência de tema | `"system" \| "light" \| "dark"` | `localStorage`, chave `dksoft.theme` | Entre visitas |
| Rascunho | string | Memória (estado acima do portão de acesso) | Visita |
| Prévias | `Map` | Memória | Visita |

**Nunca** vão a nenhum armazenamento: texto de pergunta ou resposta, `requestId`, ids de conversa, dados de aluno (FR-025, SC-006).

## Regras de validação (puras, em `lib/validation.ts`)

- `validateMessage(raw)`: `trim`; vazio → `empty`; mais de 4000 caracteres → `too_long` com o excesso; senão `ok` com o texto limpo. O contador aparece a partir de 3600 caracteres (90 %).
- `isUuid(value)`: formato UUID de qualquer versão (8-4-4-4-12 hexadecimais), o mesmo conjunto que o `z.string().uuid()` do servidor aceita; usada pela rota `/c/:conversationId`.
- A contagem usa `text.length` (unidades UTF-16), exatamente como o `z.string().trim().max(4000)` do servidor. Contar por pontos de código deixaria passar, por exemplo, uma mensagem com emojis que o servidor recusaria com `400`; um teste fixa esse caso.

## Máquina de estados do turno

```text
            SEND                META             TOOL_START           TOKEN
 (nenhum) ───────► pending ────────────► working ───────────► working ───────► streaming
                      │                    │  ▲                  │                │ │
                      │                    │  └── TOOL_END ◄─────┘                │ │
                      │                    │                                       │ │
                      │ erro HTTP          │ DONE (sem texto)                      │ │ DONE
                      ▼                    ▼                                       ▼ ▼
                    error               done ◄─────────────────────────────────── done
                      ▲                    ▲
        ERROR/connection_lost/            (done.partial = true marca o turno como parcial)
        client_timeout (em qualquer       
        estado ativo)                     ABORT (em qualquer estado ativo) ──► interrupted
```

- `pending`: pergunta enviada, ainda sem `meta`. O indicador de atividade já aparece (FR-004).
- `working`: `meta` recebido; consultas em andamento ou ainda sem texto.
- `streaming`: chegou ao menos um `token`.
- Terminais: `done`, `error`, `interrupted`. Depois de um terminal, nenhuma ação (exceto `RESET`) altera o turno; eventos atrasados são descartados.
- `ERROR` com texto parcial já recebido **mantém** o texto e marca o turno como incompleto (US3, cenário 4).
- Reenvio ("Tentar novamente") descarta o turno com erro e cria um novo com a mesma pergunta; a conversa existente é a mesma (`conversationId`).

### Ações do reducer (`lib/chat-reducer.ts`)

`LOAD_START`, `LOAD_OK(messages)`, `LOAD_ERROR(err)`, `LOAD_NOT_FOUND`, `SEND(question, key)`, `META(requestId, conversationId)`, `TOOL_START(name, label)`, `TOOL_END(name, label, ok)`, `TOKENS(text)` (já em lote), `DONE(data)`, `ERROR(err)`, `ABORT`, `RESET`. O reducer é puro e não conhece rede, relógio nem DOM.

## Tradução de erros (resumo)

| Entrada | `kind` | `action` |
|---------|--------|----------|
| HTTP 401 `unauthorized` | `unauthorized` | `reauthenticate` |
| HTTP 403 `origin_not_allowed` | `origin_not_allowed` | `none` |
| HTTP 404 `conversation_not_found` | `conversation_not_found` | `new-conversation` |
| HTTP 429 `rate_limited` | `rate_limited` | `wait` (contagem regressiva de `retryAfterSeconds`, padrão 60) |
| HTTP 400 `invalid_body` | `invalid_body` | `none` (o texto é mantido para edição) |
| HTTP 500 `internal_error` | `server_error` | `retry` |
| Stream `error.code` = `timeout` | `timeout` | `retry` |
| Stream `error.code` = `model_unavailable` | `model_unavailable` | `retry` |
| Stream `error.code` = `tools_unavailable` | `tools_unavailable` | `retry` |
| Stream `error.code` = `internal_error` | `server_error` | `retry` |
| `fetch` rejeita (rede) | `network` | `retry` |
| Leitor termina sem `done`/`error` | `connection_lost` | `retry` |
| Prazo de 150 s no cliente | `client_timeout` | `retry` |
| Resposta fora do schema ou erro HTTP sem corpo JSON válido | `unexpected_response` | `retry` |

## Relacionamentos

```text
ConversationList ── abre ──► ConversationView (1 ativa por aba)
ConversationView 1 ──── * Turn
Turn 1 ──── * ToolNotice
AccessKey ── autoriza ──► todas as chamadas (cabeçalho Authorization)
```

Duas abas abertas têm estados independentes (cada uma com seu `sessionStorage` e sua `ConversationView`); a mesma conversa aberta em duas abas é possível, e a fila por conversa do servidor serializa as perguntas.

## Fora do modelo (por decisão)

Usuário, tenant, perfil, título e exclusão de conversa, mensagens de ferramenta, métricas por pergunta além de `model` e `durationMs`, e qualquer estrutura para gráficos ou voz (spec 002, fora de escopo).
