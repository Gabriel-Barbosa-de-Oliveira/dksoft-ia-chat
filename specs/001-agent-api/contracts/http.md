# Contrato HTTP: API do Agente de Chat

**Feature**: [spec.md](../spec.md) | **Dados**: [data-model.md](../data-model.md)

Base: `http://localhost:3000` (porta por `PORT`). Todas as rotas, exceto `GET /health`, exigem:

```text
Authorization: Bearer <CHAT_ACCESS_KEY>
```

Toda resposta (inclusive erro) leva o cabeçalho `X-Request-Id` (UUID gerado no servidor; o valor enviado pelo cliente é ignorado) e, nos corpos JSON de erro, o campo `requestId` (FR-020).

## Erros antes do stream (JSON)

Formato: `{ "requestId": "<uuid>", "error": "<codigo>", ... }`

| Status | `error` | Quando |
|--------|---------|--------|
| 400 | `invalid_body` | Corpo fora do schema (vazio, só espaços, > 4000 caracteres, `conversationId` não UUID). Inclui `issues` do zod |
| 401 | `unauthorized` | Chave ausente ou incorreta. Corpo **idêntico** nos dois casos |
| 403 | `origin_not_allowed` | Origem de navegador fora da allowlist (preflight ou requisição) |
| 404 | `conversation_not_found` | `conversationId` inexistente. Inclui `conversationId` |
| 429 | `rate_limited` | Limite de requisições por IP no `/chat`. Inclui `retryAfterSeconds` |
| 500 | `internal_error` | Falha inesperada antes de abrir o stream |

Nenhum erro antes do stream consulta a API DKSOFT nem o modelo (SC-004).

## `GET /health`

Público. `200 { "status": "ok" }`. Não expõe versões, caminhos nem estado interno.

## `POST /chat`

Corpo (`application/json`):

```json
{ "message": "Quais parcelas em aberto o aluno de matrícula 1234 tem?", "conversationId": "<uuid opcional>" }
```

Sem `conversationId`, uma conversa nova é criada. Resposta `200` com `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, mais `X-Request-Id` e `X-Conversation-Id`. Cada evento segue o formato SSE (`event:`, `data:` em uma linha JSON, linha em branco). Cliente: `fetch` com `ReadableStream` (o `EventSource` não serve: é só GET e sem cabeçalhos).

Sequência típica:

```text
event: meta
data: {"requestId":"…","conversationId":"…"}

event: tool
data: {"phase":"start","name":"dksoft_find_student","label":"Buscando o aluno pela matrícula…"}

event: tool
data: {"phase":"end","name":"dksoft_find_student","label":"Buscando o aluno pela matrícula…","ok":true}

event: token
data: {"text":"O aluno "}

event: token
data: {"text":"tem 2 parcelas…"}

event: done
data: {"requestId":"…","conversationId":"…","model":"<modelo que respondeu>","durationMs":4210,"partial":false}
```

### Regras do stream

- `meta` é sempre o primeiro evento. Depois dele só existem `tool`, `token` e **um** evento terminal: `done` ou `error`. Nunca os dois.
- Depois que o `200` foi enviado, falhas viram o evento `error` (o status HTTP não muda): `{ "requestId", "code", "message" }` com `code` ∈ `timeout`, `model_unavailable`, `tools_unavailable`, `internal_error`. `message` é texto humano, sem stack, sem credenciais e sem mensagem crua do provedor.
- Toda pergunta que passou da validação termina com `done` ou `error`; se a conexão do cliente fechar, a execução é cancelada e registrada como `aborted` (SC-008).
- `done.partial = true` indica que algum resultado de consulta foi cortado antes de chegar ao modelo; o texto da resposta precisa avisar isso (FR-021).
- O par pergunta/resposta só é gravado na conversa quando o terminal é `done`.
- Perguntas simultâneas na **mesma** conversa são enfileiradas: a segunda só começa quando a primeira termina.

## `GET /conversations`

Query: `limit` (1–100, padrão 20), `offset` (≥ 0, padrão 0). Ordem: mais recente primeiro.

```json
{ "conversations": [ { "id": "…", "createdAt": "…", "updatedAt": "…" } ], "limit": 20, "offset": 0 }
```

## `GET /conversations/:id/messages`

```json
{ "conversationId": "…", "messages": [ { "id": 1, "role": "user", "content": "…", "createdAt": "…" }, { "id": 2, "role": "assistant", "content": "…", "createdAt": "…" } ] }
```

`404 conversation_not_found` se o id não existir ou não for UUID.

## CORS

Preflight (`OPTIONS`) com `Origin` na allowlist (`CHAT_CORS_ORIGINS`, comparação exata) responde `204` com os cabeçalhos; origem fora da lista recebe `403 origin_not_allowed`. Requisições sem `Origin` (curl, testes) não são afetadas. Os cabeçalhos de CORS também precisam estar presentes na resposta SSE (ver research.md, item 4).

## O que o contrato NÃO tem (de propósito)

Login por usuário, `tenantId`, `DELETE` de conversa, aprovação de ações e qualquer rota que escreva na API DKSOFT.
