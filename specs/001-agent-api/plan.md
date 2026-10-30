# Implementation Plan: API do Agente de Chat

**Branch**: `feat/001-agent-api` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-agent-api/spec.md`

## Summary

Um backend (`api/`) que recebe uma pergunta em linguagem natural, aciona um agente LangChain 1.x sobre o OpenRouter, consulta a API DKSOFT pelas tools do MCP existente (`mcp/`, por stdio) e devolve a resposta aos poucos por SSE. A conversa tem histórico em SQLite; o acesso exige uma chave; dados pessoais são mascarados nos registros; falhas do modelo e da API são tratadas sem derrubar o fluxo.

Abordagem técnica (detalhes e evidências em [research.md](./research.md)):

- **Agente**: `createAgent` com middlewares oficiais de retry e fallback (`onFailure: "error"`, ordem validada em teste), tools do MCP via `MCPAdapter` 2.0 com allowlist somente leitura.
- **Precisão**: totais e somas calculados por código (`shapeToolResult`), com corte de volume e aviso de resultado parcial; períodos longos divididos em janelas de 30 dias por código (`splitPeriod`).
- **Limites da API**: limitador de concorrência e de taxa no `api/`; `429` com retry e mensagem clara.
- **Pré-requisito no `mcp/`**: duas correções de robustez (status HTTP e janela de 30 dias), pois sem elas a US4 não é atingível.

## Technical Context

**Language/Version**: TypeScript ^5.9 ESM `strict`, Node 24 LTS (a pesquisa rodou em Node 22.23; validar no 24)

**Primary Dependencies**: `fastify` ^5.12, `@fastify/cors` ^11, `@fastify/rate-limit` ^11, `langchain` ^1.6, `@langchain/core` ^1.3, `@langchain/langgraph` ^1.5, `@langchain/openai` ^1.8, `@langchain/mcp-adapters` ^2.0, `zod` ^3.25.76; dev: `tsx` ^4.23, `typescript` ^5.9, `@types/node` ^24

**Storage**: SQLite via `node:sqlite` (`DatabaseSync`), arquivo local (`CHAT_DB`), `:memory:` nos testes

**Testing**: `node:test` via `tsx`, testes ao lado do código (`*.test.ts`); modelos, tools e stores falsos, sem rede; `app.inject()` do Fastify e um teste com servidor real para o SSE

**Target Platform**: Linux server (processo único), spawn do MCP como processo filho

**Project Type**: web-service (pacote `api/`; o front `web/` é outra spec)

**Performance Goals**: primeiro sinal de atividade em até 3 s em 90% das perguntas (SC-001); `api/` não adiciona espera relevante além dos limites da API DKSOFT

**Constraints**: 60 req/min e 5 simultâneas por cliente na API DKSOFT (usamos 50/min e 4 por padrão); período financeiro ≤ 30 dias inclusivos por consulta; tempo máximo por pergunta de 120 s; mensagem de até 4000 caracteres; processo único (exclusão mútua por conversa em memória)

**Scale/Scope**: MVP com um token e poucos usuários simultâneos (gestores e equipe DKSOFT); sem multi-tenant

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado depois da Fase 1.*

| Princípio | Avaliação | Como o plano atende |
|-----------|-----------|---------------------|
| I. Camadas Explícitas | Passa | `http` (controllers) → `services` → `store`/`agent` (IO). `domain` puro e sem IO |
| II. Validação na Fronteira | Passa | zod no corpo HTTP, nas variáveis de ambiente, nos eventos SSE e no JSON de resultado das tools antes do `shapeToolResult` |
| III. Erros de Domínio | Passa | Classes (`ConversationNotFoundError`, `UnauthorizedError`, `ChatTimeoutError`, `ModelUnavailableError`, `ToolsUnavailableError`, `PeriodTooLongError`) traduzidas só em `http/errors.ts` e no emissor de eventos de erro |
| IV. Funções Puras | Passa | `loadConfig`, `splitPeriod`, `shapeToolResult`, `maskPii`, `formatSseEvent`, `isTransientModelError`, comparação de chave, núcleo do limitador (relógio injetado) |
| V. Teste Obrigatório | Passa | Modelos falsos no padrão dos spikes; tools falsas; SQLite `:memory:`; nenhum teste usa rede. Pre-commit: typecheck + test |
| VI. Segurança por Padrão | Passa | Chaves só no backend; filho recebe só `BASE_URL`/`API_TOKEN`/`PATH`; allowlist somente leitura; chave de acesso com `timingSafeEqual`; CORS exato; logs mascarados |
| VII. Spec Antes de Código | Passa | Este plano, depois `/speckit-tasks` |
| VIII. Pequeno e Reversível | Passa | Tarefas decompostas por camada, com o `mcp/` em commits separados |
| IX. Escopo de MVP | Passa | Token injetado num único ponto (`buildMcpServers(config)`); sem tenant, perfil, cofre ou cota |

**Resultado**: sem violações; Complexity Tracking não se aplica.

**Reavaliação pós-design**: mantém-se sem violações. Duas observações de conformidade: (1) o `mcp/` é alterado, mas só em robustez e com testes, sem tocar o contrato das tools; (2) `agent/` e `store/` fazem IO e são a "camada model" da constitution, sempre atrás de interfaces injetadas pelo `createApp(options)`.

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-api/
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões e evidências
├── data-model.md        # Fase 1: entidades, tabelas, eventos
├── quickstart.md        # Fase 1: validação ponta a ponta
├── contracts/
│   └── http.md          # Fase 1: contrato HTTP/SSE
├── checklists/
│   └── requirements.md  # Qualidade da spec
└── tasks.md             # Fase 2 (/speckit-tasks) — não criado aqui
```

### Source Code (repository root)

```text
mcp/                                   # existente; só correções de robustez
├── src/infrastructure/
│   ├── apiHttpError.ts                # novo: erro tipado (status, Retry-After)
│   └── {package,receivableAccount,paidBills}HttpClient.ts   # passam a checar res.ok
├── src/domain/{receivableAccount,paidBills}.ts              # janela de 30 dias inclusiva
└── tests/                             # primeiros testes do mcp/

api/                                   # novo pacote npm (sem workspaces)
├── package.json
├── tsconfig.json
├── .env.example
└── src/
    ├── index.ts                       # raiz de composição: config, deps, listen, shutdown
    ├── config.ts                      # loadConfig(env) com zod (pura)
    ├── http/
    │   ├── app.ts                     # createApp(options): injeção de dependências
    │   ├── auth.ts                    # hook de chave de acesso (timingSafeEqual)
    │   ├── cors.ts                    # allowlist exata de origens (403 fora da lista)
    │   ├── sse.ts                     # formatSseEvent (pura) + abertura do stream
    │   ├── errors.ts                  # erro de domínio → status/código
    │   └── routes/{chat,conversations,health}.ts
    ├── domain/                        # puro, sem IO
    │   ├── errors.ts
    │   ├── events.ts                  # StreamEvent (zod)
    │   ├── agent-port.ts              # AgentEvent e interface AgentRunner (services ↔ agent)
    │   ├── period.ts                  # splitPeriod
    │   ├── shape-result.ts            # shapeToolResult
    │   ├── mask-pii.ts
    │   ├── model-errors.ts            # isTransientModelError
    │   ├── tool-labels.ts             # rótulo humano por tool
    │   └── system-prompt.ts
    ├── services/
    │   ├── chat.service.ts            # orquestra histórico + agente + eventos + runs
    │   ├── conversation-lock.ts       # fila por conversa (exclusão mútua FIFO)
    │   ├── conversation-store.repository.ts   # interface
    │   ├── run-store.repository.ts            # interface
    │   └── limiter.ts                 # núcleo do limitador (relógio injetado)
    ├── agent/                         # IO: LLM e MCP
    │   ├── model.ts                   # ChatOpenAI → OpenRouter
    │   ├── tools.ts                   # MCPAdapter, allowlist, tools de período
    │   ├── middleware.ts              # retry, fallback, limitador, shape
    │   ├── agent.ts                   # createAgent + stream de eventos
    │   └── testing/scripted-model.ts  # modelo falso para os testes (sem rede)
    ├── store/                         # IO: SQLite
    │   ├── db.ts                      # abertura e schema
    │   ├── sqlite-conversation-store.ts
    │   └── sqlite-run-store.ts
    └── obs/logger.ts                  # pino do Fastify com redação + maskPii
```

Os testes ficam ao lado de cada arquivo (`*.test.ts`), como no OpsPilot.

**Structure Decision**: pacote `api/` independente ao lado de `mcp/` e do futuro `web/`, sem workspaces, igual à organização do OpsPilot. A fronteira entre camadas segue a constitution: `http` conhece `services`; `services` conhece só interfaces de `store` e `agent`; `domain` não importa nada de IO. O `createApp(options)` recebe todas as dependências, o que permite testar com fakes sem tocar a rede.
