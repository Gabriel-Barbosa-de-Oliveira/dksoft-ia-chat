# dksoft-ia-chat

Chat de IA para consultar a API DKSOFT (alunos, pacotes, contas a receber e contas pagas). O agente usa LangChain/LangGraph sobre o OpenRouter e as tools do MCP em `mcp/`. O front (`web/`) é uma spec futura.

## Estrutura

| Pasta | O que é |
|-------|---------|
| `mcp/` | Servidor MCP (stdio) que expõe a API DKSOFT como tools somente leitura |
| `api/` | Backend do agente: Fastify + LangGraph + SSE, histórico em SQLite (spec 001) |
| `data/` | Contrato da API DKSOFT |
| `specs/` | Specs, planos e tarefas (Spec Kit) |

## Rodar

```bash
npm --prefix mcp install
npm --prefix api install
cp api/.env.example api/.env   # preencha OPENROUTER_API_KEY, OPENROUTER_MODEL, API_TOKEN, CHAT_ACCESS_KEY (32+ caracteres)
npm --prefix api run dev       # sobe a API (porta 3000) e o MCP como processo filho
```

Testes e tipos: `npm --prefix mcp test`, `npm --prefix api test`, `npm --prefix api run typecheck`.

## API (resumo)

Todas as rotas, exceto `GET /health`, exigem `Authorization: Bearer <CHAT_ACCESS_KEY>`.

```bash
curl -N http://localhost:3000/chat \
  -H "Authorization: Bearer $CHAT_ACCESS_KEY" -H "content-type: application/json" \
  -d '{"message":"Quais parcelas em aberto o aluno 1234 tem?"}'
```

Resposta em SSE: `meta` → `tool`… → `token`… → `done` (ou `error`). Também: `GET /conversations` e `GET /conversations/:id/messages`. Contrato completo em [`specs/001-agent-api/contracts/http.md`](specs/001-agent-api/contracts/http.md); variáveis em [`api/.env.example`](api/.env.example).

Segredos (`API_TOKEN`, `OPENROUTER_API_KEY`) ficam só no backend. A API DKSOFT é somente leitura.

## Spec

[`specs/001-agent-api/spec.md`](specs/001-agent-api/spec.md) · [plano](specs/001-agent-api/plan.md) · [tarefas](specs/001-agent-api/tasks.md) · [quickstart](specs/001-agent-api/quickstart.md)
