# Research: API do Agente de Chat

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data**: 2026-10-30

Pesquisa da Fase 0. Tudo que está marcado **[verificado]** foi reproduzido em testes offline (modelos falsos, servidor HTTP falso e o próprio `mcp/` do repositório) num diretório temporário; nada foi inferido só da documentação. O ambiente de pesquisa usou **Node 22.23**, e o alvo do projeto é **Node 24 LTS**: os pontos sensíveis à versão estão sinalizados nos riscos.

## Decisões

### 1. Agente: `createAgent` do `langchain` 1.x, não o `createReactAgent` do OpsPilot

- **Decisão**: usar `createAgent` (pacote `langchain` ^1.6) com middlewares. Versões: `langchain` ^1.6.0, `@langchain/core` ^1.3.2, `@langchain/langgraph` ^1.5.3, `@langchain/openai` ^1.8.0, `@langchain/mcp-adapters` ^2.0.1.
- **Racional**: o OpsPilot (core 0.3 / LangGraph 0.2) precisa de um workaround grande (`toolCallingModel` + `RunnableBinding`) porque `withFallbacks` não tem `bindTools`. No 1.x, retry, fallback, limite de chamadas e resumo são middlewares oficiais, e o módulo 03 do `unipds-ia` já usa a mesma série. O padrão que vale reaproveitar do OpsPilot é a organização (camadas, injeção, erros de domínio), não o código do modelo.
- **Alternativas**: `createReactAgent` de `@langchain/langgraph/prebuilt` (legado, exige o workaround); `StateGraph` manual (mais controle, mas sem necessidade no MVP).

### 2. Retry e fallback: `[modelFallbackMiddleware, modelRetryMiddleware({ onFailure: "error" })]` **[verificado]**

- **Decisão**: o fallback fica por fora e o retry por dentro, com `onFailure: "error"`, `maxRetries: 1` e `retryOn` restrito a falhas transitórias (função pura herdada de `isTransientModelError` do OpsPilot: 408, 429, ≥500, erros de rede/timeout).
- **Evidência**: com o padrão do retry (`onFailure: "continue"`), o principal foi chamado 2 vezes, o **reserva 0 vezes**, e a pessoa receberia como "resposta" o texto `Model call failed after 2 attempts with Error: 503 provider down`. Com `"error"`: principal 2 chamadas, reserva 1, resposta correta do reserva.
- **Consequências**: o retry também envolve a chamada ao reserva. O fallback captura qualquer erro (inclusive permanente, como chave inválida), então uma falha permanente custa no máximo uma chamada extra ao reserva, sem laço de repetição (SC-006, FR-013).
- **Alternativas**: o parâmetro nativo `models: [...]` do OpenRouter (usado no exemplo do módulo 03). Ele troca de modelo no servidor deles, mas não dá para testar offline (Princípio V) e esconde qual modelo respondeu. Pode entrar depois como camada extra.

### 3. Streaming: modo `messages` do `agent.stream`, ligado ao SSE **[verificado]**

- **Decisão**: `agent.stream(input, { streamMode: ["messages", "updates"], signal })`. Do modo `messages` vêm os pedaços de texto (nó `model_request`) e o resultado das tools (nó `tools`); do `updates`, as transições.
- **Evidência**: com um modelo que notifica cada token (como o `ChatOpenAI` real), saíram os pedaços `"um " | "dois " | "tres"` separados. Uma chamada de tool aparece como `AIMessageChunk` com `tool_call_chunks[].name`.
- **Cuidado**: os eventos de `messages` com `tool_call_chunks` têm `content` vazio; só viram "token" os pedaços com texto e sem tool call. Pedaços do nó `model_request` que chegam *antes* de uma tool call (o modelo "pensando em voz alta") são entregues normalmente; a resposta final é a última sequência de texto.

### 4. Transporte HTTP: Fastify 5 com `POST /chat` respondendo `text/event-stream`

- **Decisão**: Fastify ^5.12 + `@fastify/cors` ^11 + `@fastify/rate-limit` ^11. O SSE é escrito à mão (`reply.hijack()` + `reply.raw`) com uma função pura `formatSseEvent`. O front consome com `fetch` + `ReadableStream`, não com `EventSource`.
- **Racional**: `EventSource` só faz GET e não envia cabeçalho `Authorization`; como a pergunta vai no corpo e a chave de acesso no cabeçalho, `fetch` é o caminho natural. Plugins de SSE existentes (`@fastify/sse` 0.6, `fastify-sse-v2`) são orientados a GET/`EventSource` ou ainda pré-1.0; o formato SSE é trivial de manter.
- **Cuidado (CORS)**: depois de `reply.hijack()`, os cabeçalhos definidos pelos plugins não são escritos sozinhos. É preciso passar `reply.getHeaders()` ao `reply.raw.writeHead(...)`. Tarefa com teste obrigatório (teste real com `listen` + `fetch`, não só `inject`).
- **Alternativas**: WebSocket (`@fastify/websocket`): bidirecional demais para um chat de pergunta/resposta e mais difícil de proteger; resposta JSON única (descartada: contraria a US1).

### 5. Ferramentas: `MCPAdapter` sobre o `mcp/` atual, por stdio **[verificado]**

- **Decisão**: um `MCPAdapter({ servers: { dksoft: { transport: "stdio", command: process.execPath, args: [...], env } } })` criado no start do processo e fechado no shutdown. O `env` do processo filho leva **só** `BASE_URL`, `API_TOKEN` e `PATH`.
- **Evidência**: o adapter 2.0 (cliente SDK 2) conversou normalmente com o servidor atual (SDK 1.x), listou as **10 tools** e devolveu falhas como `ToolException`. Os nomes ganham o prefixo `dksoft_` (ex.: `dksoft_list_paid_bills`).
- **Allowlist**: o `api/` só expõe ao modelo as tools cujo nome está numa lista fixa (todas `list_*`/`find_*`, somente leitura). Se um dia o MCP ganhar uma tool de escrita, ela não chega ao modelo sem alteração explícita (FR-016, Princípio VI).
- **Cuidado**: `BASE_URL` precisa incluir `/api/v1` (o MCP concatena `${BASE_URL}/financeiro/...`). A validação de configuração checa o sufixo.
- **Alternativas**: reimplementar as consultas no `api/` (duplicaria o MCP e os schemas); MCP por HTTP (fica para multi-cliente, princípio IX).

### 6. Resultado de tool: encolher e somar **por código** **[verificado]**

- **Problema medido**: uma resposta de 400 contas pagas ocupou **176 072 caracteres (~44 mil tokens)** em uma única mensagem de tool, com o JSON indentado. Um mês real pode ter milhares de linhas. O modelo não soma isso com exatidão (SC-002) e o custo/contexto explodem.
- **Decisão**: um middleware `wrapToolCall` aplica a função pura `shapeToolResult` a todo resultado de lista: calcula `total` e as somas dos campos monetários (`valor_pago` nas consultas financeiras, `valor` nas parcelas em aberto), mantém só as N primeiras linhas (padrão 40, e teto de caracteres) e acrescenta `truncado: true` e `omitidos: n` quando cortar. JSON compacto.
- **Racional**: a soma e a contagem saem de código determinístico; o modelo só redige. O aviso de resultado parcial é obrigatório na resposta (novo FR-021).
- **Alternativas**: pedir ao modelo para somar (impreciso); agregar dentro do MCP com tools novas (melhor para gráficos, fica para a spec de gráficos; aqui mudaria o contrato do `mcp/`).

### 7. Períodos financeiros: dividir em janelas por código

- **Decisão**: tools do `api/` (`financeiro_contas_pagas_periodo`, `financeiro_contas_recebidas_periodo`) substituem, para o modelo, as duas tools financeiras do MCP. Elas usam a função pura `splitPeriod(inicio, fim, 30)`, chamam o MCP janela por janela (sequencial, pelo limitador) e juntam os registros antes do `shapeToolResult`. Até 90 dias; acima disso devolvem erro de domínio que o modelo traduz em pedido para reduzir o período.
- **Racional**: dividir no modelo gastaria chamadas, erraria bordas de data e furaria o limite de requisições. As janelas de 30 dias são **inclusivas** (ver item 9).

### 8. Limites da API DKSOFT: limitador no `api/` + retry de tool

- **Fatos** (documentação da API no projeto): 60 requisições/min **por cliente**, 5 consultas simultâneas, `429` com `Retry-After` opcional, período financeiro ≤ 30 dias contando as duas datas.
- **Decisão**: `createLimiter({ maxConcurrent, perMinute, now, sleep })` (núcleo puro com relógio injetado) envolve toda invocação de tool num middleware. Padrões conservadores: **4 simultâneas e 50/min**, para deixar folga a outros consumidores do mesmo token (por exemplo, o MCP usado no editor), configuráveis. `toolRetryMiddleware` reexecuta só falhas `429`/5xx com backoff; ao esgotar, o modelo recebe uma mensagem clara de "aguarde".
- **Observação**: o limite conta requisições HTTP, e o limitador conta invocações de tool. Hoje há uma requisição por invocação (inclusive uma por página em `list_students`).

### 9. O `mcp/` precisa de duas correções de robustez (achados)

Reproduzidas e lidas no código; entram como tarefas iniciais (`mcp/` ganha seus primeiros testes):

1. **Status HTTP ignorado**. Só `studentHttpClient` checa `res.ok`. Pacotes, contas recebidas e contas pagas fazem `res.json()` direto. **[verificado]** Um `429` vira `Cannot read properties of undefined (reading 'filter')`: a causa real se perde e a US4 (explicar o limite de uso e o `Retry-After`) fica impossível. Correção: erro tipado com status e `Retry-After`, no padrão que o cliente de alunos já usa.
2. **Janela de 30 dias com diferença de um dia**. `validate...Period` rejeita só `(fim - início) / dia > 30`, o que aceita 31 dias de calendário. A documentação diz "até 30 dias, contando as duas datas" (exemplo: 01/01 a 30/01). Segundo a documentação, a API rejeitaria o dia 31; **não foi confirmado contra a API real** (sem token/rede nesta sessão). Correção: `> 29` na diferença, ou `+ 1 > 30` em dias inclusivos.

Isso muda o que a spec afirmava ("`mcp/` não muda"): passa a valer "só correções de robustez". Registrado na spec.

### 10. Memória de conversa: histórico próprio em SQLite, agente sem estado

- **Decisão**: `ConversationStore` sobre `node:sqlite`; a cada pergunta o serviço carrega as últimas **12 mensagens** (configurável) e as passa ao agente. Persistem-se só a pergunta da pessoa e o texto final do assistente, **depois** da conclusão. Falha, timeout ou desconexão não gravam o par (conversa nunca fica pela metade), mas a execução é registrada em `runs`.
- **Racional**: mesmo padrão do OpsPilot; não depende do checkpointer do LangGraph (que exigiria driver nativo extra). Guardar só o texto final evita carregar para o contexto os dumps das tools.
- **Risco aceito**: perguntas de acompanhamento ("e o mês passado?") dependem de o texto do assistente mencionar identificadores. O prompt de sistema exige citar matrícula/id e o período em toda resposta sobre um aluno.
- **Fora do MVP**: `summarizationMiddleware` (gasta uma chamada de modelo) e memória de longo prazo por usuário.
- **Concorrência**: exclusão mútua por conversa em memória (processo único), com fila; a segunda pergunta espera a primeira.

### 11. Dados pessoais: mascarar nos registros, não no caminho do modelo

- **Decisão**: `maskPii` (função pura: CPF, e-mail, telefone BR, sequências de 10–11 dígitos) aplicada a **todo texto** que vai para log ou para a tabela `runs` (inclusive mensagens de erro, que podem trazer URL com CPF). Nunca se registra o texto da pergunta (FR-018).
- **Rejeitado**: `piiMiddleware` do LangChain no caminho do modelo. Ele só traz detectores para e-mail, cartão, IP, MAC e URL, **sem CPF nem telefone**, e mascarar a entrada impediria justamente as buscas por CPF, e-mail e telefone, que são parte do produto.
- **Risco aceito**: o histórico em SQLite guarda perguntas e respostas **em claro**, pois é o contexto da conversa. O arquivo fica fora do Git, com permissão restrita; retenção é manual (spec, Assumptions).

### 12. Acesso, CORS e abuso

- **Decisão**: `Authorization: Bearer <CHAT_ACCESS_KEY>`; comparação por `timingSafeEqual` sobre o SHA-256 das duas strings (tamanho fixo); mesma resposta `401` para ausente e incorreta; chave com mínimo de 32 caracteres validado no start. CORS por allowlist exata (`CHAT_CORS_ORIGINS`). `@fastify/rate-limit` por IP em `/chat`. `/health` é público e não revela detalhes.
- **Injeção de prompt**: a defesa é estrutural (credenciais só no ambiente do processo filho; tools somente leitura numa allowlist); o prompt de sistema reforça, mas não é a barreira (SC-005).

### 13. Cancelamento e tempo máximo (melhora sobre o OpsPilot)

- **Decisão**: `AbortSignal.any([AbortSignal.timeout(CHAT_TIMEOUT_MS), abortDaConexao])` vai em `agent.stream({ signal })`. O OpsPilot só "deixa de aguardar" a execução; aqui o trabalho é de fato cancelado. Padrão: 120 s.

### 14. Configuração e modelo no OpenRouter

- `loadConfig(env)` (zod, função pura): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_MODEL_FALLBACK` (vazio ou igual = sem reserva), `API_TOKEN`, `BASE_URL`, `CHAT_ACCESS_KEY`, `CHAT_CORS_ORIGINS`, `CHAT_DB`, `PORT`, tempos e limites.
- `ChatOpenAI` apontando para `https://openrouter.ai/api/v1` com `useResponsesApi: false` (OpenRouter usa chat completions), `streaming: true`, `temperature: 0`, `maxRetries: 0` (a política de retry é só a do middleware).
- **Escolha do modelo**: precisa suportar *tool calling* e streaming. O identificador não é fixado nesta spec; o quickstart trata como variável a escolher no catálogo do OpenRouter, e a verificação com modelo real (SC-002/003) é manual.

### 15. Ferramentas de build

- TypeScript ^5.9 (o `typescript` 7.0 existe no npm, mas o OpsPilot está na série 5 e nada aqui exige o 7), `tsx` ^4.23 para executar e testar, `zod` ^3.25.76 (a mesma versão do `mcp/`; o LangChain 1.x aceita 3.25+ e 4). Pacote npm separado em `api/`, sem workspaces, como o OpsPilot.

## Riscos abertos

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | SSE depois de `hijack` perde cabeçalhos de CORS | Teste com servidor real; copiar `reply.getHeaders()` |
| R2 | Processo MCP (stdio) cair no meio do uso | Falha rápida no start; erro `tools_unavailable` no stream; reinício a validar na tarefa do adapter |
| R3 | O limite de 60/min é **por cliente**, compartilhado com quem mais usa o token | Margem (50/min) e configuração; `429` tratado com retry e mensagem |
| R4 | Dados pessoais em claro no SQLite | Arquivo fora do Git, permissão 0600, retenção manual documentada |
| R5 | Qualidade de tool calling varia por modelo | Escolha de modelo por env; verificação manual com modelo real antes de fechar a spec |
| R6 | `node:sqlite` emite `ExperimentalWarning` no Node 22 | Confirmar comportamento no Node 24 na primeira tarefa; mesma escolha do OpsPilot |
| R7 | Off-by-one do período não confirmado na API real | Dividir em janelas de 30 dias inclusivas (seguro nos dois cenários) |
| R8 | Resposta de acompanhamento sem identificador | Regra no prompt de sistema; teste com conversa de duas perguntas (SC-003) |
