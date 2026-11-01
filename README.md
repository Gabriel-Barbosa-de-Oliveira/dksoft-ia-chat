# dksoft-ia-chat

Chat de IA para consultar a API DKSOFT (alunos, pacotes, contas a receber e contas pagas). O agente usa LangChain/LangGraph sobre o OpenRouter e as tools do MCP em `mcp/`. O front (`web/`, spec 002) é Vite + React + TypeScript; para subir, veja `specs/002-chat-web-ui/quickstart.md`.

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

## Arquivos e gráficos (spec 004)

O assistente gera **PDF, Excel (.xlsx) e Word (.docx)** a partir de uma consulta e mostra **gráficos** (barras, linhas, pizza) quando ajudam.

- **Pelo chat**: "me manda isso em Excel", "exporta em PDF com o gráfico". O arquivo aparece como um cartão com nome, formato, tamanho, linhas e validade.
- **Pelo botão** **Exportar** da resposta (PDF, Excel ou Word; "Incluir gráfico" quando houver um).
- **Dados pessoais** (CPF, e-mail, telefone) saem **mascarados**. Só o pedido escrito explícito ("com o CPF completo") gera o arquivo completo; o botão nunca gera.
- **Validade**: os dados da consulta ficam até 1 h e o arquivo até 30 min, só em memória (nada em disco). Conversas antigas reabertas mostram os gráficos, mas não exportam: refaça a pergunta.
- **Desligar sem novo deploy**: `ARTIFACTS_ENABLED=false` (nenhuma rota, tool ou evento novo).

Contratos em [`specs/004-exportacao-graficos/`](specs/004-exportacao-graficos/) (`contracts/`, `quickstart.md`, `perf-notes.md`); variáveis em [`api/.env.example`](api/.env.example).

## Spec

[`specs/001-agent-api/spec.md`](specs/001-agent-api/spec.md) · [plano](specs/001-agent-api/plan.md) · [tarefas](specs/001-agent-api/tasks.md) · [quickstart](specs/001-agent-api/quickstart.md)
