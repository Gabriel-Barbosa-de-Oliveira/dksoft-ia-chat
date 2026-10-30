---

description: "Tarefas da spec 001 — API do Agente de Chat"
---

# Tasks: API do Agente de Chat

**Input**: documentos de design em `specs/001-agent-api/`

**Pré-requisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/http.md](./contracts/http.md), [quickstart.md](./quickstart.md)

**Testes**: obrigatórios. A constitution (princípio V) exige teste para toda lógica nova, então cada tarefa de implementação inclui o arquivo `*.test.ts` ao lado do código. Testes **nunca usam rede**: modelo, tools e stores são falsos (`ScriptedModel`, tools de teste, SQLite `:memory:`). A verificação com modelo e API reais é manual (T051).

**Organização**: por história de usuário, para cada uma ser implementada e validada sozinha.

## Formato: `[ID] [P?] [Story] Descrição com caminho`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[USn]**: história da spec a que a tarefa pertence (só nas fases de história)
- Caminhos relativos à raiz do repositório. Código novo em `api/src/`; os testes ficam ao lado (`*.test.ts`)
- Comandos: `npm --prefix api run typecheck`, `npm --prefix api test`, `npm --prefix mcp test`
- Cada tarefa cabe em um commit (princípio VIII); typecheck e testes verdes antes de cada commit

---

## Phase 1: Setup

**Propósito**: esqueleto do pacote `api/`.

- [ ] T001 Criar `api/package.json` (`"type": "module"`, engines Node 24; scripts `dev` = `node --env-file-if-exists=.env --import tsx src/index.ts`, `test` = `node --import tsx --test "src/**/*.test.ts"`, `typecheck` = `tsc --noEmit`; dependências `fastify`, `@fastify/cors`, `@fastify/rate-limit`, `langchain`, `@langchain/core`, `@langchain/langgraph`, `@langchain/openai`, `@langchain/mcp-adapters`, `zod`; dev `tsx`, `typescript`, `@types/node`, nas versões do [plan.md](./plan.md)) e rodar `npm --prefix api install`
- [ ] T002 Criar `api/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution` `NodeNext`, `target` ES2023, `allowImportingTsExtensions`, `noEmit`, `verbatimModuleSyntax`; `include` `src`)
- [ ] T003 [P] Atualizar `.gitignore` da raiz (`api/data/`, `*.db`, `*.db-wal`, `*.db-shm`) e criar `api/.env.example` só com os **nomes** e valores de exemplo não secretos de todas as variáveis de [data-model.md](./data-model.md#appconfig-saída-de-loadconfig)

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Propósito**: base comum do `api/` e as correções de robustez do `mcp/` ([research.md](./research.md), item 9).

**⚠️ CRÍTICO**: nenhuma história começa antes do fim desta fase.

### Correções no `mcp/` (pacote separado; em paralelo com o `api/`)

- [ ] T004 [P] Criar `mcp/src/infrastructure/apiHttpError.ts` com a classe `ApiHttpError` (status, `retryAfterSeconds?`) e a função `assertOk(res)`, que lança com mensagem do tipo `HTTP 429: usage limit exceeded (Retry-After: 7s)` (campos de erro do corpo `{status, codigo, mensagem}` quando existirem; nunca incluir o token), e `mcp/tests/apiHttpError.test.ts` (200 passa; 401, 429 com e sem `Retry-After`, 500; corpo não JSON)
- [ ] T005 Usar `assertOk` em `mcp/src/infrastructure/packageHttpClient.ts`, `receivableAccountHttpClient.ts` e `paidBillsHttpClient.ts` (o `studentHttpClient.ts` já checa `res.ok`), e **validar o JSON de sucesso com zod** (`safeParse` com os schemas de `mcp/src/domain/`, criando os que faltarem; resposta que não casa lança erro claro `Unexpected response shape from DKSOFT API: <caminho do campo>`, sem o corpo bruto; o `studentHttpClient.ts` também passa a validar, mesmo já checando `res.ok`) — FR-012, constitution II. Com `mcp/tests/httpClients.test.ts` usando `fetch` falso: um `429` deve virar a mensagem de T004, não mais `Cannot read properties of undefined`; corpo com formato inesperado e campos `null` conhecidos (depende de T004)
- [ ] T006 [P] Corrigir a janela de 30 dias **inclusiva** em `mcp/src/domain/paidBills.ts` (`validatePaidBillsPeriod`: aceitar 01/01–30/01, rejeitar 01/01–31/01; ajustar a mensagem para "30 days counting both dates") e `mcp/tests/paidBillsPeriod.test.ts` (limites, ano bissexto, datas invertidas e inválidas)
- [ ] T007 [P] Mesma correção em `mcp/src/domain/receivableAccount.ts` (`validateReceivablePeriod`) e `mcp/tests/receivablePeriod.test.ts`

### Base do `api/`

- [ ] T008 [P] Criar `api/src/config.ts` (`loadConfig(env)` pura, zod; regras e padrões do [data-model.md](./data-model.md#appconfig-saída-de-loadconfig): `BASE_URL` terminada em `/api/v1`, `CHAT_ACCESS_KEY` com 32+ caracteres, reserva vazia ou igual ao principal = sem reserva) e `api/src/config.test.ts`
- [ ] T009 [P] Criar `api/src/domain/errors.ts` com as classes de erro de domínio: `ConversationNotFoundError`, `UnauthorizedError`, `OriginNotAllowedError`, `ChatTimeoutError`, `ModelUnavailableError`, `ToolsUnavailableError`, `PeriodTooLongError`
- [ ] T010 [P] Criar `api/src/domain/events.ts` (`StreamEvent` em zod, união discriminada por `event`: `meta`, `tool`, `token`, `done`, `error`; códigos de erro do stream) e `api/src/domain/agent-port.ts` (tipos `AgentEvent` e interface `AgentRunner` — o contrato entre `services/` e `agent/`: recebe histórico, pergunta e `AbortSignal`, devolve `AsyncIterable<AgentEvent>`), com `api/src/domain/events.test.ts`
- [ ] T011 [P] Criar `api/src/domain/mask-pii.ts` (`maskPii(text)` pura: CPF com e sem pontuação, e-mail, telefone BR, sequências de 10–11 dígitos; mantém só os 2 últimos dígitos) e `api/src/domain/mask-pii.test.ts` (inclui URL `/alunos/cpf/12345678909` dentro de mensagem de erro)
- [ ] T012 [P] Criar `api/src/http/sse.ts` (`formatSseEvent(event)` pura, uma linha `data:` JSON por evento, linha em branco final) e `api/src/http/sse.test.ts`
- [ ] T013 [P] Criar `api/src/agent/testing/scripted-model.ts`: `ScriptedModel` (extende `BaseChatModel`, roteiro de respostas e de chamadas de tool, `failTimes`/`failWith`, contador de chamadas, `bindTools` que devolve o próprio modelo, e `_streamResponseChunks` que chama `runManager?.handleLLMNewToken` por pedaço — padrão validado nos spikes de [research.md](./research.md), itens 2 e 3)
- [ ] T014 Criar `api/src/store/db.ts` (`openDatabase(path)` sobre `node:sqlite` `DatabaseSync`; cria as tabelas `conversations`, `messages`, `runs` e os índices de [data-model.md](./data-model.md); `:memory:` ou arquivo, criando o arquivo com permissão `0600` e a pasta se faltar) e `api/src/store/db.test.ts` (schema, `CHECK` de `role` e `outcome`)
- [ ] T015 [P] Criar as interfaces `api/src/services/conversation-store.repository.ts` (`create`, `exists`, `lastMessages(id, n)`, `appendPair(id, user, assistant)` em transação, `listConversations(limit, offset)`, `listMessages(id)`) e `api/src/services/run-store.repository.ts` (`save(run)`)
- [ ] T016 Criar `api/src/store/sqlite-conversation-store.ts` e `api/src/store/sqlite-conversation-store.test.ts` (ordem das mensagens, `appendPair` atômico, isolamento entre conversas, `updated_at`) (depende de T014, T015)
- [ ] T017 [P] Criar `api/src/store/sqlite-run-store.ts` e `api/src/store/sqlite-run-store.test.ts` (a linha nunca contém texto da pergunta; `error_type` passa por `maskPii`) (depende de T011, T014, T015)
- [ ] T018 Criar `api/src/obs/logger.ts` (opções do pino do Fastify com `redact` de `authorization` e do corpo, serializers sem corpo de requisição, e `safeLog` que aplica `maskPii` a qualquer texto livre) e `api/src/obs/logger.test.ts` (depende de T011)
- [ ] T019 Criar `api/src/http/errors.ts` (erro de domínio → status e corpo `{ requestId, error, ... }` conforme [contracts/http.md](./contracts/http.md): 400, 401, 403, 404, 429, 500) e `toStreamError(err)` (pura): **única** tradução de erro de domínio para o evento terminal `error` do stream (`ChatTimeoutError` → `timeout`, `ModelUnavailableError` → `model_unavailable`, `ToolsUnavailableError` → `tools_unavailable`, demais → `internal_error`, sempre com `message` humana, nunca a mensagem crua do provedor), com `api/src/http/errors.test.ts` (depende de T009)
- [ ] T020 Criar `api/src/http/app.ts` (`createApp(options)` com injeção de todas as dependências; hook que gera o `X-Request-Id` no servidor e ignora o do cliente; error handler de T019; logger de T018) e `api/src/http/routes/health.ts` (`GET /health` público → `{ "status": "ok" }`), com `api/src/http/app.test.ts` via `app.inject()` (depende de T012, T018, T019)

**Checkpoint**: base pronta; `npm --prefix api test` e `npm --prefix mcp test` verdes. As histórias podem começar.

---

## Phase 3: User Story 1 — Perguntar sobre os dados e receber a resposta aos poucos (P1) 🎯 MVP

**Objetivo**: pergunta em linguagem natural → consultas reais ao MCP → resposta em SSE, com totais exatos.

**Teste independente**: [quickstart.md](./quickstart.md), cenário US1 (`curl -N` com pergunta de consulta e pergunta sem consulta). No automático: T030 com servidor real.

- [ ] T021 [P] [US1] Criar `api/src/domain/shape-result.ts` (`shapeToolResult(toolName, rawText, { maxRows, maxChars })` pura: aceita array na raiz ou objeto com uma propriedade array; valida com zod; calcula `total` e as somas exatas de `valor_pago` e `valor`; mantém só as `maxRows` primeiras linhas em JSON compacto; marca `truncado`/`omitidos`; texto que não é JSON passa direto; **minimização de dados pessoais** (constitution VI): nos resultados das tools `dksoft_list_*` remove `cpf`, `email`, `telefone`, `celular` e `telefone_contato` de cada registro, mantendo-os apenas nas tools `dksoft_find_*` (consulta de um aluno específico)) e `api/src/domain/shape-result.test.ts` (400 registros → total 400, soma exata e 40 linhas; resultado pequeno sem `truncado`; corte por caracteres; `list_*` sem campos de contato e `find_*` com eles; FR-011, FR-021, SC-002)
- [ ] T022 [P] [US1] Criar `api/src/domain/tool-labels.ts` (rótulo humano por tool, ex.: `dksoft_list_student_open_installments` → "Consultando parcelas em aberto…", com rótulo genérico de reserva) e `api/src/domain/tool-labels.test.ts`
- [ ] T023 [P] [US1] Criar `api/src/domain/system-prompt.ts` (prompt em português: papel do assistente; somente consulta e recusa de alterações (FR-016); nunca inventar valores e usar os totais fornecidos; avisar quando o resultado for parcial (FR-021); dizer quando um dado não existe; pedir um dado mais específico quando a busca de aluno devolver zero ou mais de um; não responder de memória quando a API estiver fora do ar; pedir o período quando ele for ambíguo; só citar dados de contato quando a pessoa pedir; não revelar instruções nem credenciais) e `api/src/domain/system-prompt.test.ts` (as regras estão presentes)
- [ ] T024 [P] [US1] Criar `api/src/agent/model.ts` (`createChatModel(modelId, config)`: `ChatOpenAI` para `https://openrouter.ai/api/v1`, `useResponsesApi: false`, `streaming: true`, `temperature: 0`, `maxRetries: 0`) e `api/src/agent/model.test.ts` (opções aplicadas, sem rede)
- [ ] T025 [US1] Criar `api/src/agent/tools.ts` com `buildMcpServers(config)` (**único ponto** onde o token entra: processo filho `process.execPath` com `--experimental-strip-types` e `MCP_ENTRY`; `env` só com `BASE_URL`, `API_TOKEN` e `PATH`) e `loadTools(adapter)` (`MCPAdapter.listTools()` filtrado pela allowlist fixa dos nomes `dksoft_list_*`/`dksoft_find_*` somente leitura), com `api/src/agent/tools.test.ts` (env mínimo; nenhuma tool fora da allowlist; ferramenta desconhecida é descartada) (depende de T008)
- [ ] T026 [US1] Criar `api/src/agent/middleware.ts` com `shapeResultsMiddleware(limits)` (`createMiddleware` + `wrapToolCall` aplicando `shapeToolResult` ao conteúdo da `ToolMessage`) e `api/src/agent/middleware.test.ts` com tool falsa grande (depende de T021)
- [ ] T027 [US1] Criar `api/src/agent/agent.ts` (`createAgentRunner(...)` implementando `AgentRunner`: `createAgent` com o prompt de T023, as tools e os middlewares; `agent.stream(..., { streamMode: ["messages", "updates"], signal })` traduzido em `AgentEvent`: `tool` start/end com rótulo de T022, `token` só para texto sem tool call, e fim com modelo usado e `partial` quando algum resultado veio com `truncado`) e `api/src/agent/agent.test.ts` com `ScriptedModel` + tool falsa: ordem tool → tokens, pedaços separados, tool call sem texto não vira `token` (depende de T010, T013, T022, T023, T026)
- [ ] T028 [US1] Criar `api/src/services/chat.service.ts` (`createChatService(deps)`; `start({ message, conversationId? })` cria a conversa **antes** de abrir o stream quando não há `conversationId` (o tratamento de um `conversationId` informado — existência, histórico — é a T033, na US2) e devolve `{ requestId, conversationId, events }`; `events` emite `meta`, repassa `tool`/`token`, ao concluir grava o par pergunta/resposta (`appendPair`), registra a execução em `runs` e emite `done`; em falha registra `runs` e **propaga o erro de domínio** (ou o erro original) sem traduzi-lo — a tradução para o evento `error` é só da borda, em `toStreamError` (T019), usada pela rota) e `api/src/services/chat.service.test.ts` com agente e stores falsos (depende de T010, T016, T017)
- [ ] T029 [US1] Criar `api/src/http/routes/chat.ts` e registrar em `api/src/http/app.ts`: `POST /chat` valida o corpo com zod (`message` com `trim`, 1–4000 caracteres; `conversationId` UUID opcional → 400 `invalid_body`), abre o stream com `reply.hijack()` e `reply.raw.writeHead(200, { ...reply.getHeaders(), "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no", "X-Request-Id", "X-Conversation-Id" })` (os cabeçalhos de CORS dependem disso — [research.md](./research.md), item 4), escreve cada evento com `formatSseEvent` , cancela a execução quando `reply.raw` fecha antes do fim e, se o iterador de eventos lançar, escreve **um** evento terminal `error` com `toStreamError` (T019) (depende de T012, T019, T020, T028)
- [ ] T030 [US1] Criar `api/src/http/routes/chat.test.ts` com servidor real (`listen(0)` + `fetch`): ordem `meta` → `tool` → `token`… → `done`; o primeiro `token` chega antes do `done`; cabeçalhos `X-Request-Id`/`X-Conversation-Id`; corpo inválido (vazio, só espaços, acima de 4000, `conversationId` não UUID) → 400 sem chamar o agente; origem permitida recebe os cabeçalhos de CORS **na resposta SSE** (depende de T029)
- [ ] T031 [US1] Criar `api/src/index.ts` (raiz de composição: `loadConfig(process.env)`, banco, `MCPAdapter`, agente, serviço, `createApp`, `listen`; falha rápida e mensagem clara se o MCP não subir; encerramento gracioso fechando o adapter e o banco) (depende de T025, T027, T028, T029)

**Checkpoint**: US1 funcional. Rodar o cenário US1 do quickstart com o modelo real. Para uma demonstração, é suficiente.

---

## Phase 4: User Story 2 — Continuar a conversa sem repetir o contexto (P1)

**Objetivo**: histórico por conversa, retomada por identificador, isolamento e fila por conversa.

**Teste independente**: [quickstart.md](./quickstart.md), cenário US2 (duas perguntas na mesma conversa; leitura do histórico).

- [ ] T032 [P] [US2] Criar `api/src/services/conversation-lock.ts` (exclusão mútua FIFO por chave; libera mesmo se a execução lançar) e `api/src/services/conversation-lock.test.ts`
- [ ] T033 [US2] Em `api/src/services/chat.service.ts`: com `conversationId`, lançar `ConversationNotFoundError` **antes** de abrir o stream; carregar `lastMessages(id, historyLimit)` e entregar ao agente como histórico; adquirir o lock da conversa no início do iterador de eventos e liberar no `finally`; e estender `chat.service.test.ts` (o segundo turno recebe o par do primeiro; conversa B não vê a conversa A; janela limitada a N; inexistente → erro sem criar conversa) (depende de T028, T032)
- [ ] T034 [P] [US2] Criar `api/src/http/routes/conversations.ts` (`GET /conversations?limit&offset` e `GET /conversations/:id/messages`, com zod e 404 `conversation_not_found`) e registrar em `app.ts`, com `api/src/http/routes/conversations.test.ts` via `inject` (ordem mais recente primeiro; limites 1–100) (depende de T016, T020)
- [ ] T035 [P] [US2] Em `api/src/domain/system-prompt.ts`: exigir que toda resposta sobre um aluno cite matrícula/id e período consultado (para o contexto sobreviver ao histórico só com texto — [research.md](./research.md), item 10 e R8) e atualizar `system-prompt.test.ts`
- [ ] T036 [US2] Criar `api/src/http/routes/chat.conversation.test.ts` com servidor real: `conversationId` inexistente → 404 JSON sem stream, sem linha em `runs` e sem conversa nova; duas perguntas simultâneas na mesma conversa → a segunda só começa depois do `done` da primeira e o histórico mantém a ordem (depende de T029, T033)

**Checkpoint**: US1 e US2 funcionam juntas.

---

## Phase 5: User Story 3 — Acesso protegido e dados pessoais resguardados (P2)

**Objetivo**: só quem tem a chave usa o chat; nenhuma credencial nem dado pessoal em claro nos registros.

**Teste independente**: [quickstart.md](./quickstart.md), cenário US3 (sem chave, chave errada, origem não autorizada, inspeção de logs e `runs`).

- [ ] T037 [P] [US3] Criar `api/src/http/auth.ts` (`verifyAccessKey` pura: SHA-256 das duas strings + `timingSafeEqual`; hook `onRequest` que exige `Authorization: Bearer`, exceto `GET /health` e preflight; sempre a mesma resposta 401, byte a byte, para chave ausente e incorreta) e `api/src/http/auth.test.ts` (inclui verificar que nenhuma consulta ao agente acontece sem chave — SC-004)
- [ ] T038 [P] [US3] Criar `api/src/http/cors.ts` (allowlist exata de `CHAT_CORS_ORIGINS`: preflight com origem permitida → 204 com cabeçalhos; origem fora da lista → 403 `origin_not_allowed` na requisição e no preflight; sem `Origin` passa; usa `@fastify/cors` para os cabeçalhos) e `api/src/http/cors.test.ts`
- [ ] T039 [US3] Em `api/src/http/app.ts`: registrar CORS **antes** da autenticação (o preflight não leva `Authorization`) e `@fastify/rate-limit` por IP em `POST /chat` (`CHAT_RATE_LIMIT_PER_MIN`, padrão 30; resposta 429 `rate_limited` com `retryAfterSeconds`; `trustProxy` configurável), e estender `app.test.ts` com a ordem dos hooks e o limite (depende de T037, T038, T020)
- [ ] T040 [US3] Criar `api/src/http/privacy.test.ts`: executar `POST /chat` com agente falso e coletar a saída do logger, a tabela `runs` e os eventos SSE para uma pergunta com CPF, e-mail e telefone e uma falha de tool cuja mensagem traz `/alunos/cpf/…`; afirmar que `API_TOKEN`, `OPENROUTER_API_KEY` e `CHAT_ACCESS_KEY` não aparecem em lugar nenhum e que CPF, e-mail e telefone não aparecem em claro nos logs nem em `runs` (o histórico em `messages` guarda o texto por desenho) — SC-005 (depende de T039)

**Checkpoint**: US1–US3 funcionam; o chat não é mais aberto.

---

## Phase 6: User Story 4 — Continuar funcionando quando algo falha (P2)

**Objetivo**: retry e reserva do modelo, limites da API DKSOFT, períodos longos, tempo máximo e fim sempre explícito.

**Teste independente**: [quickstart.md](./quickstart.md), cenário US4 (75 dias, resultado enorme, modelo principal inválido, `429`).

- [ ] T041 [P] [US4] Criar `api/src/domain/model-errors.ts` (`isTransientModelError`: 408, 429, ≥ 500, códigos de rede e timeout; permanente: 400, 401, 403, 404) e `classifyAgentError(err)` (pura: erro bruto → `ModelUnavailableError`, `ToolsUnavailableError`, `ChatTimeoutError` ou o original; reconhece status 5xx/429 do provedor, `ToolException` e `AbortError`/`TimeoutError`), com `api/src/domain/model-errors.test.ts` (porte da função do OpsPilot `ops-pilot/src/agents/model.ts`; `classifyAgentError` testada com erros no formato real: status 503, `ToolException`, `AbortError`)
- [ ] T042 [P] [US4] Criar `api/src/domain/period.ts` (`splitPeriod(inicio, fim, 30)` pura: janelas consecutivas **inclusivas**, sem sobreposição nem buraco; até 90 dias; acima disso `PeriodTooLongError`; datas inválidas ou invertidas são erro) e `api/src/domain/period.test.ts` (30 dias → 1 janela; 31 → 2; 75 → 3; 91 → erro; virada de mês e ano bissexto)
- [ ] T043 [P] [US4] Criar `api/src/services/limiter.ts` (`createLimiter({ maxConcurrent, perMinute, now, sleep })`: núcleo com relógio e espera injetados; limite de simultâneas e janela deslizante por minuto; FIFO; libera a vaga mesmo com erro) e `api/src/services/limiter.test.ts`
- [ ] T044 [US4] Em `api/src/agent/middleware.ts`: `resilienceMiddleware(config)` com `[modelFallbackMiddleware(reserva), modelRetryMiddleware({ maxRetries: 1, retryOn: isTransientModelError, onFailure: "error" })]` (**`"error"` é obrigatório**, senão o reserva nunca roda — [research.md](./research.md), item 2), `toolRetryMiddleware` por fora e `toolLimiterMiddleware(limiter)` por dentro dele (cada tentativa pega a sua vaga; a espera do backoff não segura vaga) com retry só para `429`/5xx; o limitador **isenta** as tools de período (`financeiro_*_periodo`), que já pedem uma vaga por janela ao chamar a tool MCP (T045), evitando vaga aninhada, e `modelTracker` (mais interno; guarda o modelo da última chamada bem-sucedida), e estender `middleware.test.ts` com `ScriptedModel`: principal sempre 503 → resposta do reserva (principal 2 chamadas, reserva 1); erro permanente → sem repetição no principal; sem reserva → o erro sobe; tool com `429` → duas repetições e depois a falha vira mensagem para o modelo; tool de período com `maxConcurrent` 1 não trava) (depende de T013, T026, T041, T043)
- [ ] T045 [US4] Em `api/src/agent/tools.ts`: tools `financeiro_contas_pagas_periodo` e `financeiro_contas_recebidas_periodo` (`tool()` com zod: `data_inicial`, `data_final` e os filtros que a tool MCP aceitar) que dividem o período com `splitPeriod`, chamam a tool MCP janela a janela, **cada chamada pegando uma vaga do limitador** (única aquisição por requisição HTTP; o middleware de T044 não envolve estas tools), juntam os registros e entregam ao `shapeToolResult`; as duas tools financeiras do MCP saem do conjunto exposto ao modelo; período acima de 90 dias devolve mensagem de domínio clara; estender `tools.test.ts` com tools MCP falsas (75 dias → 3 chamadas sequenciais com as janelas certas e total consolidado; 91 dias → nenhuma chamada; período de 3 janelas com `maxConcurrent` 1 conclui sem deadlock) (depende de T025, T042, T043)
- [ ] T046 [US4] Em `api/src/services/chat.service.ts`: `AbortSignal.any([AbortSignal.timeout(timeoutMs), sinalDaConexão])` repassado ao agente; resultado `ok`/`error`/`timeout`/`aborted` gravado em `runs` com `model_used` e `tool_calls`; erros brutos do agente passam por `classifyAgentError` (T041) e viram erros de domínio que o serviço **propaga** (a tradução para o evento `error` é de `toStreamError`, T019, na rota T029 — constitution III); sempre um único evento terminal; sem gravar o par quando não houver `done`; estender `chat.service.test.ts` (agente que trava + timeout curto; abort; falha do modelo; falha das tools: o iterador lança o erro de domínio certo) e `routes/chat.test.ts` (o erro vira um único evento `error` com o código certo) — FR-017, SC-008 (depende de T033, T041)
- [ ] T047 [US4] Compor tudo em `api/src/agent/agent.ts` e `api/src/index.ts` (ordem dos middlewares, limitador, modelo de reserva da config, `getModelUsed` do `modelTracker`, allowlist final) e criar `api/src/agent/composition.test.ts` com a composição inteira e dublês: pergunta de 75 dias, principal fora do ar com reserva respondendo (`done.model` = reserva), `429` da API virando explicação ao usuário (depende de T044, T045, T046)

**Checkpoint**: as quatro histórias funcionam juntas.

---

## Phase 7: Polish e transversais

- [ ] T048 [P] Atualizar `README.md` (como rodar `mcp/` e `api/`, variáveis, link para a spec) e `CLAUDE.md` (comandos `npm --prefix api …`, env, estrutura real do `api/`)
- [ ] T049 [P] Revisão de segurança: buscar em `api/src` e `mcp/src` qualquer log de conteúdo de pergunta, token ou chave; confirmar que `.env` não é lido por código nem por skills; `npm --prefix api audit --omit=dev` e `npm --prefix mcp audit --omit=dev`, registrando o resultado no PR
- [ ] T050 Rodar tudo em `mcp/` e `api/`: `npm --prefix mcp test`, `npm --prefix api run typecheck`, `npm --prefix api test`, inclusive no Node 24, o alvo do projeto (R6 em `specs/001-agent-api/research.md`)
- [ ] T051 Validar com o modelo e a API DKSOFT **reais** seguindo todo o `specs/001-agent-api/quickstart.md`: observar SC-001 a SC-008 (SC-002 e SC-003 com o modelo escolhido), confirmar na API real se o dia 31 é recusado (R7) e registrar os resultados no PR

---

## Dependências e ordem de execução

### Entre fases

- **Setup (1)** → **Foundational (2)** → histórias → **Polish (7)**.
- Na Foundational, o bloco `mcp/` (T004–T007) é independente do bloco `api/` (T008–T020) e roda em paralelo. Só a **US4** depende do `mcp/` corrigido para o comportamento de `429` e de janela de 30 dias; antes disso o resto funciona.
- **US1 (P1)** depende só da Foundational. **US2 (P1)** estende `chat.service.ts` de T028 e usa o fluxo de US1. **US3 (P2)** depende do `app.ts` da Foundational e da rota de US1. **US4 (P2)** depende de US2 (`chat.service.ts`) e de T025/T026.
- Arquivos compartilhados entre histórias (`chat.service.ts`, `middleware.ts`, `tools.ts`, `system-prompt.ts`, `app.ts`) são editados **em sequência** na ordem das fases, nunca em paralelo.

### Dentro de cada história

Domínio puro (teste junto) → agente/middleware → serviço → rota → composição. Cada tarefa deixa typecheck e testes verdes.

### Grafo resumido

```text
T001 → T002 → T003
            ├─ T004 → T005          (mcp, independente)
            ├─ T006, T007           (mcp, independente)
            └─ T008..T013 [P] → T014 → T016, T017 → T018, T019 → T020
T020 → US1: T021..T024 [P] → T025 → T026 → T027 → T028 → T029 → T030 → T031
US1  → US2: T032 [P] → T033 → T034 [P], T035 [P] → T036
US1  → US3: T037 [P], T038 [P] → T039 → T040
US2 + mcp (T005..T007) → US4: T041..T043 [P] → T044 → T045 → T046 → T047
tudo → T048 [P], T049 [P] → T050 → T051
```

## Exemplos de paralelismo

```text
# Foundational, depois de T002:
T004 mcp/apiHttpError   T006 mcp/paidBills   T007 mcp/receivable   T008 config   T009 errors
T010 events+port        T011 mask-pii        T012 sse              T013 scripted-model

# US1, domínio e modelo juntos:
T021 shape-result       T022 tool-labels     T023 system-prompt    T024 model

# US3, duas peças independentes:
T037 auth               T038 cors

# US4, três peças puras:
T041 model-errors       T042 period          T043 limiter
```

## Estratégia de implementação

### MVP primeiro (US1)

1. Setup (T001–T003) e Foundational (T004–T020).
2. US1 (T021–T031).
3. **Parar e validar** com o cenário US1 do quickstart e o modelo real. Isso já é uma demonstração, mas **não deve ser exposta fora da sua máquina**: a US3 (chave de acesso, CORS, limite) ainda não existe.

### Entrega incremental

1. + US2 → conversas com contexto.
2. + US3 → pode ser exposto a outras pessoas.
3. + US4 → robusto a falhas e a períodos longos.
4. Polish e validação real (T048–T051).

### Cobertura dos requisitos

| Requisito | Tarefas |
|-----------|---------|
| FR-001, FR-003 | T025, T027, T028 |
| FR-002 | T010, T012, T027, T029, T030 |
| FR-004, FR-005, FR-006, FR-007 | T016, T028, T033, T034, T036 |
| FR-008, FR-009 | T037, T038, T039 |
| FR-010, FR-011 | T011, T017, T018, T025, T040 |
| FR-012 | T008, T010, T019, T021, T029 |
| FR-013 | T041, T044, T047 |
| FR-014, FR-015 | T006, T007, T042, T043, T044, T045 |
| FR-016 | T023, T025 |
| FR-017 | T046 |
| FR-018 | T014, T017, T046 |
| FR-019 | T034 |
| FR-020 | T020, T019 |
| FR-021 | T021, T023, T026 |

## Notas

- [P] = arquivos diferentes e sem dependência incompleta.
- O rótulo `[USn]` liga a tarefa à história, para rastreabilidade.
- Fazer commit a cada tarefa ou grupo lógico; correções do `mcp/` (T004–T007) em commits separados dos do `api/`.
- Nunca ler nem commitar `.env`; nenhum teste usa rede.
