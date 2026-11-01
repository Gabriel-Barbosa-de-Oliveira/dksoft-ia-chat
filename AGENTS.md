# DKSOFT IA Chat

Chat de IA para consultar a API DKSOFT (alunos, pacotes, contas a receber e contas pagas). O agente é LangChain/LangGraph sobre OpenRouter e usa as tools do MCP em `mcp/`. O front é próprio, separado do front do LangGraph.

## Estrutura

- `mcp/` — servidor MCP (stdio) que expõe a API DKSOFT como tools; já existe, com token no `.env`
- `api/` — backend do agente (Fastify + LangGraph + SSE), spec 001; camadas `http/` → `services/` → `store/` e `agent/`, `domain/` puro; testes ao lado do código
- `web/` — front do chat (Vite + React + TS), spec 002; camadas `components → hooks → (api, storage) → lib`, `lib` puro; testes ao lado do código
- `data/` — contrato da API (`openapi.json`, `api-types.ts`)
- `specs/` — specs, planos e tarefas do Spec Kit

## Stack

- Node 24 LTS
- TypeScript ESM, `strict`
- zod na fronteira (HTTP, env, respostas externas)
- Testes com `node:test` via `tsx`
- Fastify como servidor HTTP, streaming por SSE
- SQLite via `node:sqlite` (`DatabaseSync`); `:memory:` em testes
- LangChain/LangGraph 1.x sobre OpenRouter, com modelo de reserva
- Frontend em `web/` (Vite + React + TS), pacote npm separado — design em `.github/instructions/design.instructions.md`

## Comandos

- `npm --prefix mcp test` · `npm --prefix api test` · `npm --prefix api run typecheck`
- `npm --prefix api run dev` (lê `api/.env`; variáveis em `api/.env.example`)
- `npm --prefix web run dev` · `typecheck` · `lint` · `test` · `build` · `test:e2e` (E2E usa servidor falso do contrato 001; ver `specs/002-chat-web-ui/quickstart.md`)

## Convenções

- Camadas padrão MVC (Model, Service, Controller)
- Entrada externa é sempre validada com zod
- Erros de domínio são classes, traduzidas na borda
- Lógica nova nasce com teste; typecheck e teste sempre verdes
- Sempre utilize funções puras
- Nunca commitar segredos nem ler `.env`
- `API_TOKEN` e `OPENROUTER_API_KEY` ficam só no backend; a API DKSOFT é somente leitura
- Escopo de MVP: um token, sem multi-tenant (constitution, princípio IX)
- Trabalho em branch `feat/NNN-nome`; nunca direto na `master`

## Fluxo

Seguir o fluxo do Spec Kit: `/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`. Specs são versionadas em `specs/`. A constitution está em `.specify/memory/constitution.md`.
