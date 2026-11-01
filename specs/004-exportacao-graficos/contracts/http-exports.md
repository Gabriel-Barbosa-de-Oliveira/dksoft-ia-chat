# Contrato HTTP: Exportação e histórico com gráficos

**Feature**: [spec.md](../spec.md) | **Dados**: [data-model.md](../data-model.md) | **Base**: [001 / contracts/http.md](../../001-agent-api/contracts/http.md)

Mudanças **aditivas** ao contrato da spec 001. Tudo que a 001 define (chave de acesso `Authorization: Bearer <CHAT_ACCESS_KEY>`, `X-Request-Id`, CORS por allowlist, corpo de erro `{ requestId, error, ... }`) continua valendo. Rotas novas só existem com `ARTIFACTS_ENABLED=true`.

## `POST /exports`

Gera um arquivo a partir de um resultado vivo, **sem passar pelo modelo** (botão "Exportar"). Sempre com dados pessoais **mascarados**.

Corpo (`application/json`):

```json
{
  "conversationId": "<uuid>",
  "resultId": "<uuid>",
  "format": "xlsx",
  "chartId": "<uuid opcional>"
}
```

| Campo | Regra |
|-------|-------|
| `conversationId` | UUID obrigatório; precisa existir |
| `resultId` | UUID obrigatório; precisa ser um resultado vivo **desta** conversa |
| `format` | `pdf`, `xlsx` ou `docx` |
| `chartId` | Opcional; UUID de gráfico vivo **do mesmo resultado**. Inclui o gráfico no arquivo |

`201 Created`:

```json
{
  "requestId": "<uuid>",
  "file": {
    "id": "<uuid>",
    "conversationId": "<uuid>",
    "resultId": "<uuid>",
    "name": "contas-recebidas-20261031-213015.xlsx",
    "format": "xlsx",
    "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "sizeBytes": 48211,
    "rowCount": 312,
    "includesChart": false,
    "containsFullPersonalData": false,
    "createdAt": "2026-10-31T21:30:15.000Z",
    "expiresAt": "2026-10-31T22:00:15.000Z",
    "downloadPath": "/conversations/<uuid>/exports/<uuid>"
  }
}
```

Erros (corpo `{ requestId, error, ... }`):

| Status | `error` | Quando |
|--------|---------|--------|
| 400 | `invalid_body` | Corpo fora do schema (inclui `issues` do zod) |
| 401 | `unauthorized` | Chave ausente ou incorreta (corpo idêntico, como na 001) |
| 403 | `origin_not_allowed` | Origem fora da allowlist |
| 404 | `conversation_not_found` | `conversationId` inexistente |
| 404 | `result_not_found` | Resultado desconhecido, de outra conversa ou **vencido**. Corpo igual nos três casos |
| 404 | `chart_not_found` | `chartId` desconhecido, vencido ou de outro resultado |
| 413 | `export_too_large` | Resultado com mais linhas que o limite. Inclui `rows` e `maxRows` |
| 422 | `nothing_to_export` | Resultado sem registros |
| 429 | `rate_limited` | Limite por IP (`EXPORT_RATE_LIMIT_PER_MIN`). Inclui `retryAfterSeconds` |
| 429 | `export_busy` | Já há `EXPORT_MAX_CONCURRENCY` gerações em andamento. Inclui `retryAfterSeconds` |
| 504 | `export_timeout` | Passou de `EXPORT_TIMEOUT_MS` |
| 500 | `internal_error` | Falha inesperada na geração (sem detalhe interno no corpo) |
| 404 | `not_found` | Rota inexistente, inclusive com `ARTIFACTS_ENABLED=false` |

Efeitos: grava uma linha em `export_runs` (`origin = "button"`). Nenhuma chamada à API DKSOFT nem ao modelo.

## `GET /conversations/:conversationId/exports/:fileId`

Baixa o arquivo. Exige `Authorization: Bearer <CHAT_ACCESS_KEY>`. **Não há endereço público**: sem a chave, ou com outra conversa na rota, a resposta é recusada. O front usa `fetch` com o cabeçalho e salva o resultado como `Blob`; nenhuma chave ou assinatura trafega na URL.

`200`:

```text
Content-Type: <mime do arquivo>
Content-Disposition: attachment; filename="contas-recebidas-20261031-213015.xlsx"; filename*=UTF-8''contas-recebidas-20261031-213015.xlsx
Content-Length: <bytes>
Cache-Control: no-store
X-Content-Type-Options: nosniff
X-Request-Id: <uuid>
```

| Status | `error` | Quando |
|--------|---------|--------|
| 401 | `unauthorized` | Chave ausente ou incorreta |
| 404 | `file_not_found` | `fileId` desconhecido, de outra conversa ou vencido. Corpo igual nos três casos |

O servidor não diferencia "vencido" de "inexistente"; a interface compara `expiresAt` do cartão com o relógio para escolher o texto ("expirou" ou "não está mais disponível").

## `GET /conversations/:id/messages` (alterado)

Cada mensagem do assistente pode trazer `charts` (campo **novo e opcional**; ausente quando não houve gráfico). Clientes que não o conhecem continuam funcionando.

```json
{
  "conversationId": "<uuid>",
  "messages": [
    { "id": 1, "role": "user", "content": "…", "createdAt": "…" },
    {
      "id": 2, "role": "assistant", "content": "…", "createdAt": "…",
      "charts": [ { "id": "<uuid>", "type": "bar", "title": "…", "…": "ChartSpec completo" } ]
    }
  ]
}
```

Só a especificação do gráfico é persistida. **Arquivos, resultados e botões de exportar não vêm no histórico** (FR-024).

## CORS

A allowlist e os métodos já cobrem `POST` e `GET` com `Authorization`. Nada de novo a liberar, pois o front não precisa ler `Content-Disposition` (usa o nome do descritor).

## Cabeçalhos de segurança do download

`Cache-Control: no-store` e `X-Content-Type-Options: nosniff` obrigatórios; o corpo nunca é registrado em log; o log da requisição mostra a rota com `:fileId` mascarado (`/conversations/:id/exports/:id`).

## O que o contrato NÃO tem (de propósito)

URL pública ou assinada de download, exportação de conversas antigas, `DELETE` de arquivo (a expiração cuida), parâmetro para pedir dados pessoais completos no `POST /exports` (só o pedido escrito, validado no servidor, libera isso) e qualquer rota que escreva na API DKSOFT.
