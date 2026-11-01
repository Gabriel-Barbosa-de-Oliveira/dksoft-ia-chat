# Implementation Plan: Exportação de Arquivos e Gráficos no Chat

**Branch**: `feat/004-exportacao-graficos` | **Date**: 2026-10-31 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-exportacao-graficos/spec.md`

## Summary

Duas capacidades novas sobre o MVP validado (specs 001 e 002):

1. **Arquivos** (PDF, Excel, Word): o middleware que já intercepta cada resultado de consulta passa a guardar os **registros brutos** num armazém em memória (1 h, ligado à conversa) e a dar ao modelo só um `resultId`. Uma tool `exportar_arquivo` (pedido escrito) e uma rota `POST /exports` (botão) chamam o **mesmo serviço**, que monta uma tabela tipada a partir dos registros, aplica a máscara de dados pessoais e gera o arquivo num **worker thread**. O arquivo fica em memória por 30 min e é baixado por `GET /conversations/:id/exports/:fileId`, que exige a chave de acesso (download por `fetch` + `Blob`, sem segredo na URL).
2. **Gráficos**: a tool `gerar_grafico` recebe só *o que agrupar e medir*; uma função pura no servidor calcula os valores exatos e produz uma **especificação de gráfico** validada (tipo, título, eixo x, séries), enviada ao front por evento SSE, guardada com a resposta no histórico e reaproveitável nos arquivos (renderizada em PNG no servidor). O front desenha com **SVG próprio**, sem biblioteca, com resumo em texto, tabela de dados e séries distinguíveis por cor, forma e padrão.

Abordagem completa e alternativas em [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript ESM `strict` em Node 24 LTS (imagem `node:24-bookworm-slim`); `api/` aceita Node ≥ 22.13 e `web/` ≥ 22.22

**Primary Dependencies**:
- `api/` (novas): `pdfmake` ^0.3.13 (PDF), `docx` ^9.15 (Word), `write-excel-file` ^4.1 (Excel), `@resvg/resvg-js` ^2.6 (SVG → PNG). Já existentes e reaproveitados: `fastify`, `zod`, `@langchain/*`, `langchain`
- `web/` (novas): nenhuma; gráficos em SVG próprio com React 19
- Embarcado no repositório: fontes Archivo TTF (OFL) em `api/assets/fonts/`

**Storage**: memória do processo para resultados (1 h), arquivos (30 min) e gráficos vivos, com tetos de tamanho; SQLite existente ganha `messages.artifacts` (JSON de gráficos) e a tabela `export_runs`. Nada de dado pessoal em disco além do que o histórico já guarda

**Testing**: `node:test` via `tsx` em `api/` e `web/` (sem rede; modelo, MCP e API DKSOFT como fakes); geradores testados reabrindo os arquivos; E2E Playwright + axe com servidor falso ampliado

**Target Platform**: contêiner Linux x64 glibc no Fly.io (1 máquina, 1 vCPU compartilhada, 1 GB, volume `/data`); front estático na Vercel; navegadores atuais de computador e celular

**Project Type**: serviço web (`api/` Fastify + SSE) com SPA separada (`web/`), mais o MCP já existente em `mcp/` (sem mudança)

**Performance Goals**: arquivo pronto em ≤ 15 s para até 1.000 linhas (SC-001); gráfico visível junto do texto da resposta, desenho em < 300 ms para 6 séries × 24 pontos; geração sem pausar os streams de outras pessoas

**Constraints**: link de arquivo expira em 30 min e resultado em 1 h (configuráveis); até 5.000 linhas por arquivo (configurável, ver risco R3); no máximo 2 gerações simultâneas e 30 s por geração; teto de memória: resultados 64 MB e arquivos 96 MB; uma única máquina; dados pessoais mascarados por padrão

**Scale/Scope**: equipe pequena de uma escola ou da DKSOFT (dezenas de pessoas), um token, sem multi-tenant (princípio IX); 3 tools novas, 1 rota de geração, 1 rota de download, 3 eventos SSE, 3 componentes novos no front

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Avaliação | Como a feature cumpre |
|-----------|-----------|-----------------------|
| I. Camadas explícitas | ✅ | `domain/` puro (agregação, tabela, máscara, SVG, nomes); IO e CPU pesada só em `services/`, `store/` e na nova pasta `render/` (adaptadores chamados só por services); `http/routes/exports.ts` só traduz HTTP |
| II. Validação na fronteira | ✅ | zod em: corpo de `POST /exports`, `ChartRequest`, `ChartSpec`, artefatos das tools, eventos SSE (api e web), `messages.artifacts` ao ler, config nova |
| III. Erros de domínio | ✅ | Classes novas (`ResultNotFoundError`, `ExportTooLargeError`, `ExportBusyError`, `ExportTimeoutError`, `ChartNotPossibleError`, `NothingToExportError`) traduzidas só em `http/errors.ts` e, para o modelo, no texto das tools |
| IV. Funções puras | ✅ | Agregação do gráfico, tabela de exportação, máscara, nome de arquivo, resumo, geometria, `asksForFullPersonalData` e SVG estático são puros; relógio e UUID injetados |
| V. Teste obrigatório | ✅ | Todo módulo novo nasce com `.test.ts`; renderizadores testados offline reabrindo os arquivos; typecheck e testes verdes por pacote |
| VI. Segurança por padrão | ✅ com ação | Sem segredo novo no front; download exige a chave e não usa URL assinada; dados pessoais mascarados por padrão e liberados por regra **do servidor** (não do modelo); registros e arquivos só em memória; as 3 tools novas não escrevem na API DKSOFT; logs sem conteúdo. Ação: nenhuma exceção a registrar |
| VII. Spec antes de código | ✅ | Spec 004 aprovada (clarificações FR-008 e FR-024 resolvidas); este plano segue para `/speckit-tasks` com revisão humana |
| VIII. Pequeno e reversível | ✅ | Entregas por história (abaixo), uma tarefa por commit, e a chave `ARTIFACTS_ENABLED` desliga rotas, tools e eventos sem novo deploy |
| IX. Escopo de MVP | ✅ | Um token, sem tenant: resultados e arquivos são ligados à **conversa**, não a cliente; o token continua entrando por injeção num só ponto |
| Stack obrigatória | ⚠️ **ação** | Entram 4 bibliotecas de geração de arquivos no `api/` e armazéns em memória (o texto lista SQLite como banco). Nenhum item listado é trocado, mas a constitution trata a stack como lista fechada. **Ação (tarefa T-fundação)**: emenda **MINOR 1.0.0 → 1.1.0** acrescentando à stack as bibliotecas `pdfmake`, `docx`, `write-excel-file`, `@resvg/resvg-js` e o princípio de "estado efêmero em memória, com expiração, para resultados e arquivos". Requer aprovação humana |

**Resultado do gate (pré-pesquisa)**: aprovado, condicionado à emenda acima.

**Reavaliação pós-design (Fase 1)**: mantém-se aprovado. O desenho **reforça** o princípio VI (valores e dados pessoais controlados pelo servidor, nada em disco). Nenhuma violação nova; os custos de complexidade estão em *Complexity Tracking*.

## Project Structure

### Documentation (this feature)

```text
specs/004-exportacao-graficos/
├── plan.md              # Este arquivo
├── research.md          # Fase 0: decisões e alternativas
├── data-model.md        # Fase 1: entidades, regras e estados
├── quickstart.md        # Fase 1: roteiro de validação
├── contracts/
│   ├── http-exports.md  # POST /exports, download, histórico com gráficos
│   ├── sse-events.md    # eventos result, chart, file
│   ├── agent-tools.md   # tools, prompt e mapeamento de eventos
│   └── ui.md            # gráfico, menu Exportar, cartão de arquivo, textos
├── checklists/
│   └── requirements.md  # Qualidade da spec (já completo)
└── tasks.md             # Fase 2 (/speckit-tasks — NÃO criado aqui)
```

### Source Code (repository root)

Aplicação web com dois pacotes já existentes. Itens novos marcados com `+`; alterados com `~`. Cada módulo tem seu `.test.ts` ao lado.

```text
api/
├── assets/fonts/                      + Archivo TTF (Regular, SemiBold) e OFL.txt
├── src/
│   ├── config.ts                      ~ variáveis novas (tabela abaixo)
│   ├── index.ts                       ~ monta armazéns, serviços, worker e rotas
│   ├── domain/
│   │   ├── errors.ts                  ~ erros de domínio novos
│   │   ├── events.ts                  ~ eventos result / chart / file
│   │   ├── agent-port.ts              ~ AgentInput.conversationId; AgentEvent chart/file/result
│   │   ├── shape-result.ts            ~ inclui resultId no resumo; usa extract-rows
│   │   ├── system-prompt.ts           ~ regras 11–15
│   │   ├── extract-rows.ts            + registros de um texto bruto de tool (extraído de shape-result)
│   │   ├── result-label.ts            + descrição legível do resultado, sem dado pessoal
│   │   ├── chart-spec.ts              + ChartSpec, limites, validateChartSpec
│   │   ├── chart-request.ts           + ChartRequest (zod)
│   │   ├── build-chart.ts             + agregação exata → ChartSpec
│   │   ├── chart-summary.ts           + texto alternativo
│   │   ├── chart-svg.ts               + SVG estático (para PNG)
│   │   ├── column-dictionary.ts       + campo → rótulo, tipo, sensível
│   │   ├── export-table.ts            + registros → ExportTable (máscara, tipos, totais, avisos)
│   │   ├── full-pii-request.ts        + asksForFullPersonalData
│   │   └── export-name.ts             + nome do arquivo sem dado pessoal
│   ├── services/
│   │   ├── result-store.repository.ts + interface do armazém de resultados e gráficos vivos
│   │   ├── file-store.repository.ts   + interface do armazém de arquivos
│   │   ├── document-renderer.ts       + porta: renderizar(tabela, gráfico?, formato) → bytes
│   │   ├── export.service.ts          + orquestra: valida, limite, fila, renderiza, guarda, registra
│   │   ├── chart.service.ts           + agrega, valida, registra o gráfico
│   │   └── export-run-store.repository.ts + interface do registro de funcionamento
│   ├── store/
│   │   ├── db.ts                      ~ messages.artifacts + export_runs (migração idempotente)
│   │   ├── sqlite-conversation-store.ts ~ lê/grava charts
│   │   ├── memory-result-store.ts     + TTL, tetos, varredura
│   │   ├── memory-file-store.ts       + TTL, tetos, varredura
│   │   └── sqlite-export-run-store.ts + registro sem conteúdo
│   ├── render/                        + adaptadores de geração (só services os chamam)
│   │   ├── pdf.ts  docx.ts  xlsx.ts   + um por formato
│   │   ├── chart-png.ts               + SVG → PNG com fontes embarcadas
│   │   ├── worker.ts  worker-pool.ts  + worker thread com tempo máximo e fila
│   │   └── index.ts                   + implementa DocumentRenderer
│   ├── agent/
│   │   ├── artifact-tools.ts          + resultados_disponiveis, gerar_grafico, exportar_arquivo
│   │   ├── middleware.ts              ~ shapeResults grava resultado e devolve resultId/artefato
│   │   └── agent.ts                   ~ tools por execução; emite result/chart/file
│   ├── services/chat.service.ts       ~ repassa eventos; persiste charts da resposta no `done`
│   └── http/
│       ├── app.ts                     ~ registra rotas novas (se habilitadas)
│       ├── errors.ts                  ~ traduz erros novos
│       └── routes/
│           ├── exports.ts             + POST /exports e GET download
│           └── conversations.ts       ~ messages devolve charts
web/
├── e2e/fake-api.ts                    ~ servidor falso emite result/chart/file e serve arquivos
├── src/
│   ├── api/exports.ts                 + POST /exports e download autenticado por Blob
│   ├── hooks/useExport.ts             + estado do pedido e do cartão
│   ├── lib/
│   │   ├── events.ts                  ~ novos eventos (desconhecidos continuam ignorados)
│   │   ├── chart-spec.ts  chart-layout.ts  chart-a11y.ts  chart-palette.ts  format-value.ts   + 
│   │   ├── export-state.ts            + máquina de estados do cartão
│   │   ├── chat-reducer.ts            ~ result, charts, files; histórico com charts
│   │   └── errors.ts  failures.ts     ~ códigos de exportação
│   ├── components/
│   │   ├── ChartView.tsx (+ .module.css)    + figura SVG, legenda, tabela de dados
│   │   ├── ExportMenu.tsx (+ .module.css)   + menu Exportar
│   │   ├── FileCard.tsx (+ .module.css)     + cartão de arquivo
│   │   └── TurnView.tsx               ~ posiciona gráfico, cartões e menu
│   └── styles/app-tokens.css          ~ tokens --chart-* nos dois temas
Dockerfile                             ~ copia api/assets; teste de fumaça do worker e do resvg
DEPLOY.md  README.md  CLAUDE.md        ~ variáveis, ordem de deploy, estrutura
.specify/memory/constitution.md        ~ emenda 1.1.0 (após aprovação)
```

**Structure Decision**: manter os dois pacotes existentes (`api/` e `web/`) sem criar projeto novo. No `api/` surgem apenas dois diretórios: `render/` (adaptadores de geração de arquivo, tratados como camada de IO ao lado de `store/`, chamados somente por `services/`) e `assets/fonts/`. Contratos entre pacotes continuam **espelhados à mão** (padrão atual de `events.ts`), sem pacote compartilhado.

## Configuração nova

Lidas e validadas com zod em `api/src/config.ts`; exemplos em `api/.env.example`; `DEPLOY.md` documenta os do Fly.

| Variável | Padrão | Função |
|----------|--------|--------|
| `ARTIFACTS_ENABLED` | `true` | Liga rotas, tools e eventos novos. `false` restaura o comportamento do MVP |
| `RESULT_TTL_MS` | `3600000` | Vida dos resultados consultados (1 h) |
| `RESULT_MAX_ROWS` | `20000` | Teto de registros guardados por resultado |
| `RESULT_STORE_MAX_MB` | `64` | Teto de memória dos resultados |
| `EXPORT_TTL_MS` | `1800000` | Vida de arquivo e link (30 min) |
| `EXPORT_MAX_ROWS` | `5000` | Limite de linhas por arquivo (FR-005) |
| `EXPORT_TIMEOUT_MS` | `30000` | Tempo máximo de geração |
| `EXPORT_MAX_CONCURRENCY` | `2` | Gerações simultâneas |
| `FILE_STORE_MAX_MB` | `96` | Teto de memória dos arquivos |
| `EXPORT_RATE_LIMIT_PER_MIN` | `20` | Limite por IP de `POST /exports` |

## Cobertura de requisitos

| Requisitos | Onde são atendidos |
|-----------|--------------------|
| FR-001, FR-003, FR-011, FR-012 | `exportar_arquivo`, `resultados_disponiveis`, `export.service`, `FileCard`, prompt (regras 12 e 14) |
| FR-002, FR-016 | Armazém de resultados + `resultId` no resumo; `build-chart` e `export-table` calculam sobre os registros guardados |
| FR-004 | `memory-file-store` (TTL), rota de download com chave e vínculo à conversa, 404 uniforme |
| FR-005, FR-025 | `export.service` (limite, fila, tempo máximo) e tradução de erros em `http/errors.ts` e em `contracts/ui.md` |
| FR-006, FR-007, FR-009 | `export-table`, `column-dictionary`, `export-name`, renderizadores (células tipadas, texto nunca como fórmula) |
| FR-008 | `export-table` (máscara), `full-pii-request` (regra do servidor), selo no cartão |
| FR-010 | `POST /exports` + `ExportMenu` (mesmo `export.service`, sempre mascarado) |
| FR-013, FR-014, FR-015, FR-017, FR-020 | `gerar_grafico`, `chart-request`, `build-chart`, `chart-spec` (limites e validação), prompt (regra 11) |
| FR-018 | `ChartView`, `chart-a11y`, `chart-palette`, tokens `--chart-*`, axe no E2E |
| FR-019 | `messages.artifacts`, `GET messages` com `charts`, `LOAD_OK` no reducer |
| FR-021 | `chart-svg` → `chart-png` → incorporado em PDF, Word e Excel |
| FR-022, FR-026 | Mesmas camadas de auth/CORS/leitura; `ARTIFACTS_ENABLED=false` e testes de regressão |
| FR-023, SC-007 | `export_runs` e logs sem conteúdo (`safeLog` + `maskPii`) |
| FR-024 | TTL de 1 h, sem persistência, `result` fora do histórico, botão só com resultado vivo |

## Entregas por história (insumo para `/speckit-tasks`)

Cada fase é publicável e reversível por si só; a ordem respeita as dependências.

| Fase | Conteúdo | Depende de |
|------|----------|-----------|
| 0. Fundação | Emenda da constitution (aprovação humana); teste de regressão que trava o comportamento do front de **ignorar eventos desconhecidos** (já existe); dependências, fontes e `Dockerfile`; configuração e `ARTIFACTS_ENABLED`; teste mínimo do artefato de tool (R1) e do worker/resvg na imagem (R2) | — |
| 1. Captura de resultados | `extract-rows`, `memory-result-store`, `resultId` no resumo, evento `result`, `resultados_disponiveis` | 0 |
| 2. US1 Arquivo por pedido | `export-table`, dicionário de colunas, máscara, `full-pii-request`, renderizadores PDF/Word/Excel no worker, `memory-file-store`, `export.service`, tool `exportar_arquivo`, evento `file`, rota de download, `FileCard` | 1 |
| 3. US2 Gráficos | `chart-spec`, `chart-request`, `build-chart`, `chart.service`, tool `gerar_grafico`, evento `chart`, persistência no histórico, `ChartView` com acessibilidade e temas | 1 |
| 4. US3 Botão Exportar | `POST /exports`, `ExportMenu`, estados e erros do cartão | 2 |
| 5. US4 Gráfico nos arquivos | `chart-svg`, `chart-png`, incorporação nos três formatos, opção "Incluir gráfico" | 2 e 3 |
| 6. US5 Limites e falhas | Textos e estados de erro/expiração/regeneração, `export_runs`, ocupado/timeout, E2E de falhas | 2 e 4 |
| 7. Fechamento | Desempenho e memória (R3, R4), E2E com axe nos dois temas, documentação (README, DEPLOY, CLAUDE.md), checagem dos SC-001 a SC-009 | todas |

## Riscos e verificações

Detalhados em [research.md](./research.md#riscos-abertos-viram-tarefas-de-verificação): **R1** artefato de tool com o `createAgent`; **R2** worker com `tsx` e binário do `resvg` na imagem; **R3** tempo de 5.000 linhas em PDF/Word numa vCPU compartilhada; **R4** memória dos armazéns; **R5** falso negativo do pedido explícito de dados completos (lado seguro: mascarado).

Dependência de licença a registrar: `@resvg/resvg-js` é MPL-2.0 (uso como dependência sem modificação, compatível); fontes Archivo sob OFL (arquivo de licença junto das fontes).

## Complexity Tracking

Nenhuma violação da constitution sem justificativa. Custos de complexidade assumidos de propósito:

| Escolha | Por que é necessária | Alternativa mais simples rejeitada porque |
|---------|---------------------|------------------------------------------|
| Pasta `render/` + worker thread | A máquina tem 1 vCPU compartilhada e atende SSE; gerar PDF/Word de milhares de linhas no laço principal pararia os streams de todos | Gerar no processo principal: simples, mas degrada o chat de outras pessoas (risco R3) |
| Estado efêmero em memória (resultados, arquivos) | Dados pessoais e financeiros não podem ficar em disco além do necessário; expiração por tempo cumpre FR-004 e FR-024 | SQLite ou volume `/data`: persistiria dados pessoais e exigiria rotina de limpeza e criptografia |
| Acoplamento a uma única máquina | Consequência direta do item acima; já é a regra do `DEPLOY.md` ("não rode `fly scale count 2`") | Armazenar em S3/R2 com URL assinada: nova infraestrutura, novo segredo e link utilizável sem a chave |
| Geometria do gráfico implementada duas vezes (SVG estático no `api/`, SVG interativo no `web/`) | Pacotes isolados por constituição; o servidor precisa de PNG para os arquivos e o navegador precisa de tema, dica e tabela | Pacote compartilhado ou biblioteca de gráficos: mexe na estrutura do repositório ou adiciona peso e estilo difícil de alinhar ao Modernist. Mitigação: testes dos dois lados com as mesmas especificações de exemplo |
| Emenda da constitution (1.1.0) | Registrar as novas bibliotecas e o estado efêmero como parte da stack | Adicionar dependências sem registro deixaria a constitution desatualizada em relação ao código |
