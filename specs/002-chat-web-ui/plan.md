# Implementation Plan: Interface Web do Chat

**Branch**: `feat/002-frontend-chat` | **Date**: 2026-10-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-chat-web-ui/spec.md`

## Summary

Um pacote `web/` (Vite + React + TypeScript `strict`, como já fixa a constitution) que consome a API do agente da spec 001 sem alterar o contrato: tela de acesso com a chave, conversa com resposta em partes por `fetch` + `ReadableStream`, histórico paginado, rotas `/` e `/c/:conversationId`, tratamento humano de cada erro, tema claro/escuro, acessibilidade WCAG 2.1 AA e layout responsivo no design system Modernist.

Abordagem técnica (decisões e evidências em [research.md](./research.md)):

- **Domínio puro em `src/lib/`**: decodificador SSE, schemas zod dos eventos e respostas, reducer do turno, tradução de erros, validação da pergunta, tema, rolagem, contagem regressiva, rótulos de conversa e contraste. Testado com `node:test` via `tsx`, sem navegador e sem rede.
- **IO isolado** em `src/api/` (clientes `fetch` com `fetch` injetável) e `src/storage/` (chave em `sessionStorage`, tema em `localStorage`, ambos com fallback em memória). Componentes finos.
- **Design system**: o `styles.css` do Modernist vendorizado, **quase intacto** (só sai o `@import` do Google Fonts; Archivo vem de `@fontsource/archivo`), mais uma camada própria de tokens para o que o DS não tem: tema escuro, degraus de espaço de 48 e 64 px e alvos de 44 px.
- **Achado de acessibilidade**: o DS, como entregue, não atinge AA no tema claro (rótulo do botão primário em 3,76 : 1, bordas de campo em 2,41 : 1, textos secundários entre 3,16 e 4,24 : 1). A camada de tokens corrige usando apenas degraus das rampas do próprio DS ([research.md, item 9](./research.md#9-achados-de-acessibilidade-do-ds-contraste-calculado)), e um teste de tokens impede regressão.
- **Sem backend novo**: sem mudança em `api/` nem em `mcp/`. Gráficos e voz continuam fora (spec 002), com dois pontos de extensão baratos já previstos.

## Technical Context

**Language/Version**: TypeScript ^5.9.3 ESM `strict` (mesmo do `api/`), Node 24 LTS (`engines` `>=22.22`, por causa do `react-router` 8)

**Primary Dependencies**: `react` ^19.3, `react-dom` ^19.3, `react-router` ^8.5, `zod` ^3.25.76, `react-markdown` ^10.1, `remark-gfm` ^4.0, `lucide-react` ^1.65, `@fontsource/archivo` ^5.3; dev: `vite` ^8.3, `@vitejs/plugin-react` ^6.1, `typescript` ^5.9.3, `tsx` ^4.23, `@types/node` ^24, `@types/react` ^19, `@types/react-dom` ^19, `oxlint`, `playwright` ^1.64, `@axe-core/playwright` ^4.14

**Storage**: nenhum no servidor desta spec. No navegador: `sessionStorage` (chave de acesso), `localStorage` (preferência de tema) e memória (rascunho, prévias). Nunca conteúdo de conversa (FR-025)

**Testing**: `node:test` via `tsx` ao lado do código (`*.test.ts`/`*.test.tsx`): `lib/`, clientes `api/` com `fetch` falso, `Markdown` por `renderToStaticMarkup`, teste de tokens (hex/px literais e contraste); E2E em `e2e/` com `node:test` + biblioteca `playwright` + `@axe-core/playwright` contra um servidor falso do contrato 001 em `localhost`

**Target Platform**: navegadores atuais de computador e celular, largura a partir de 320 px; hospedagem estática com fallback para `index.html`

**Project Type**: web-app (pacote `web/`, front separado do front do LangGraph; consome o `api/` da 001)

**Performance Goals**: pergunta e indicador de atividade na tela em até 1 s após o envio (SC-001); sem re-renderização do Markdown por token (descarga em lote por quadro de animação)

**Constraints**: pergunta de 1 a 4000 unidades UTF-16; prazo de 150 s por pergunta no cliente (o servidor limita em 120 s); um turno ativo por conversa; chave só em memória de sessão do navegador; sem HTML bruto do texto; sem `px`/hex/fonte literais fora dos arquivos de token; alvos de 44 px; contraste AA

**Scale/Scope**: MVP com poucos usuários simultâneos; 2 rotas, 1 tela de acesso, 1 tela de chat com painel de histórico, cerca de 15 componentes

## Constitution Check

*GATE: avaliado antes da Fase 0 e reavaliado depois da Fase 1.*

| Princípio | Avaliação | Como o plano atende |
|-----------|-----------|---------------------|
| I. Camadas Explícitas | Passa | Adaptação ao front, em um só sentido: `components` → `hooks` → (`api`, `storage`) → `lib`. `lib/` é o domínio, puro e sem React, `fetch`, DOM ou relógio; IO só em `api/` e `storage/` |
| II. Validação na Fronteira | Passa | zod em toda resposta HTTP, em todo evento do stream e no valor lido do `storage`; falha de schema vira `unexpected_response`, nunca estado parcial |
| III. Erros de Domínio | Passa | Falhas previsíveis são valores de `UserError` produzidos por `toUserError` (pura) na borda dos hooks; nenhum `catch` genérico exibe `error.message` |
| IV. Funções Puras | Passa | `SseDecoder`, `StreamEventSchema`, `chatReducer`, `toUserError`, `validateMessage`, `isUuid`, `resolveTheme`, `shouldFollow`, `remainingSeconds(now, deadline)` (relógio por parâmetro), `previewOf`, `joinTokens`, `contrastRatio` |
| V. Teste Obrigatório | Passa | Toda lógica nova nasce com teste `node:test`; `typecheck`, `lint`, `test` e `build` verdes; E2E contra servidor falso local, sem rede externa e sem o modelo nem a API DKSOFT |
| VI. Segurança por Padrão | Passa | `API_TOKEN` e a chave do OpenRouter nunca chegam ao front; a chave do chat fica só em sessão, nunca em URL, log ou `VITE_*`; sem HTML bruto; CSP sem `unsafe-inline`; nenhum dado de conversa no navegador |
| VII. Spec Antes de Código | Passa | Fluxo Spec Kit: este plano, depois `/speckit-tasks` |
| VIII. Pequeno e Reversível | Passa | Fatias de implementação abaixo, cada uma cabendo em poucos commits independentes |
| IX. Escopo de MVP | Passa | Uma chave, sem login, sem tenant; chave isolada em `storage/access-key.ts` e injetada no cliente `api/` por um único ponto |

**Seção "Frontend (`web/`)" da constitution**: Vite + React + TS `strict` em pacote separado ✔; zod valida respostas e eventos ✔; lógica em `web/src/lib/` testada com `node:test` via `tsx` e componentes finos ✔; CSS com tokens (espaçamento em escala, cores semânticas, dark mode) conforme `.github/instructions/design.instructions.md` ✔. Nenhuma troca de stack, portanto sem amendment.

**Resultado**: sem violações; Complexity Tracking não se aplica.

**Reavaliação pós-design**: mantém-se sem violações. Três observações de conformidade: (1) o E2E usa a biblioteca `playwright` **dentro** do `node:test`, não o executor próprio dele, para manter "testes com `node:test`"; (2) os degraus de espaço `--space-12` (48 px) e `--space-16` (64 px) ampliam a escala do DS, mas coincidem com os valores já fixados em `design.instructions.md`; fica registrado para revisão humana, como o documento pede; (3) a correção de contraste do DS está em arquivo próprio, sem editar a cópia vendorizada.

## Project Structure

### Documentation (this feature)

```text
specs/002-chat-web-ui/
├── plan.md                      # Este arquivo
├── research.md                  # Fase 0: decisões, contraste calculado, riscos
├── data-model.md                # Fase 1: tipos, máquina de estados, armazenamento
├── quickstart.md                # Fase 1: como subir e validar
├── contracts/
│   ├── api-consumption.md       # Fase 1: o que o front usa do contrato 001
│   └── ui.md                    # Fase 1: telas, estados, a11y e textos pt-BR
├── checklists/
│   └── requirements.md          # Qualidade da spec
└── tasks.md                     # Fase 2 (/speckit-tasks), não criado aqui
```

### Source Code (repository root)

```text
web/                                      # novo pacote npm (sem workspaces)
├── package.json                          # scripts: dev, build, preview, typecheck, lint, test, test:e2e, fake-api
├── tsconfig.json                         # strict, jsx react-jsx, moduleResolution bundler
├── vite.config.ts
├── index.html                            # <script src="/theme-init.js"> antes do bundle
├── .env.example                          # VITE_API_BASE_URL=http://localhost:3000
├── .oxlintrc.json                        # derivado do _adherence.oxlintrc.json do DS
├── public/
│   ├── theme-init.js                     # aplica data-theme antes da primeira pintura (sem unsafe-inline)
│   └── favicon.svg
├── e2e/                                  # node:test + playwright (biblioteca) + axe
│   ├── fake-api.ts                       # servidor node:http roteirizável do contrato 001 (SSE, erros, 429, queda)
│   ├── helpers.ts                        # abre navegador, temas, larguras, axe
│   └── {access,chat,history,errors,a11y,responsive}.test.ts
└── src/
    ├── main.tsx                          # raiz: provedores, roteador, estilos
    ├── App.tsx                           # rotas
    ├── lib/                              # DOMÍNIO: puro, sem IO, sem React
    │   ├── sse.ts                        # SseDecoder (quadros partidos, \r\n, comentários)
    │   ├── events.ts                     # zod: StreamEvent, ApiErrorBody, ConversationPage, MessagesResponse
    │   ├── chat-reducer.ts               # máquina de estados do turno + conversa
    │   ├── errors.ts                     # UserError e toUserError (pt-BR)
    │   ├── validation.ts                 # validateMessage, isUuid
    │   ├── conversation-label.ts         # data/hora e previewOf (60 caracteres)
    │   ├── join-tokens.ts                # junção em lote dos tokens
    │   ├── scroll-follow.ts              # shouldFollow
    │   ├── countdown.ts                  # remainingSeconds(now, deadline)
    │   ├── theme.ts                      # resolveTheme(pref, systemDark)
    │   ├── suggestions.ts                # 5 sugestões do estado vazio
    │   ├── contrast.ts                   # contrastRatio (usado pelo teste de tokens)
    │   └── __fixtures__/                 # exemplos do contrato 001 (fonte dos testes e do servidor falso)
    ├── api/                              # IO: fetch
    │   ├── client.ts                     # createApiClient({ baseUrl, getKey, fetch }) → erros tipados
    │   ├── chat-stream.ts                # streamChat(): POST /chat → AsyncIterable<StreamEvent>, abort e prazo
    │   └── conversations.ts              # listConversations, getMessages
    ├── storage/                          # IO: navegador
    │   ├── access-key.ts                 # sessionStorage + fallback em memória
    │   └── theme-preference.ts           # localStorage + fallback
    ├── hooks/                            # "controller": liga IO e reducer
    │   ├── useAccessKey.ts
    │   ├── useChat.ts                    # turno ativo: envia, consome o stream, aborta, reenvia
    │   ├── useConversation.ts            # histórico da conversa aberta
    │   ├── useConversationList.ts        # paginação do painel
    │   ├── useConversationPreview.ts     # fila de prévias (concorrência 2, cache em memória)
    │   ├── useTheme.ts
    │   ├── useCountdown.ts
    │   ├── useAnnouncer.ts               # região aria-live
    │   └── useAutoFollow.ts              # rolagem acompanhando o fim
    ├── components/                       # "view": finos
    │   ├── AppShell.tsx                  # nav, aside, main, link de pular
    │   ├── AccessGate.tsx
    │   ├── Thread.tsx · TurnView.tsx · ToolNotices.tsx
    │   ├── Markdown.tsx                  # react-markdown + remark-gfm; links e tabelas
    │   ├── Composer.tsx                  # textarea, contador, Enviar/Parar, slot de ações
    │   ├── EmptyState.tsx                # sugestões
    │   ├── ConversationList.tsx · HistorySheet.tsx
    │   ├── StatusNotice.tsx              # erro / aviso / interrompida: moldura + ícone + rótulo
    │   ├── ConfirmDialog.tsx             # <dialog> nativo
    │   ├── Skeleton.tsx · ThemeToggle.tsx · LiveRegion.tsx
    ├── pages/ChatPage.tsx                # compõe tudo; rotas / e /c/:conversationId
    └── styles/
        ├── modernist.css                 # cópia vendorizada do DS (única alteração: sem @import do Google Fonts)
        ├── fonts.css                     # imports de @fontsource/archivo 400/600/800
        ├── app-tokens.css                # tema escuro, --space-12/16, --target-min, correções de contraste
        ├── app.css                       # layout do app e componentes próprios
        └── tokens.test.ts                # guard: hex/px literal, fontes e contraste
```

Os testes ficam ao lado de cada arquivo (`*.test.ts`), como no `api/`.

**Structure Decision**: pacote `web/` independente ao lado de `api/` e `mcp/`, sem workspaces e com `node_modules` próprio, como já previa a spec 001 (research/plan: "futuro `web/`"). A fronteira de camadas segue a constitution adaptada ao front: `lib/` não importa nada de IO nem de React; `api/` e `storage/` conhecem `lib/`; `hooks/` conhecem `api/`, `storage/` e `lib/`; `components/` conhecem `hooks/` e `lib/` apenas por tipos e funções puras de apresentação. O cliente HTTP recebe `fetch` e a leitura da chave por parâmetro, o que permite testá-lo sem rede. A cópia do DS fica separada da camada própria para a ressincronização ser recopiar um arquivo.

## Fatias de implementação

Ordem sugerida para `/speckit-tasks`, cada fatia em commits pequenos e reversíveis, com `typecheck`, `lint` e `test` verdes ao fim de cada uma:

0. **Esqueleto**: `web/` com Vite, TS `strict`, scripts, oxlint, `@fontsource/archivo`, DS vendorizado, `app-tokens.css`, `theme-init.js`, `.env.example`. Atualizar `CLAUDE.md` e `README.md` com os comandos do `web/`.
1. **Domínio puro e fixtures**: `sse`, `events`, `validation`, `errors`, `chat-reducer`, `join-tokens`, `scroll-follow`, `countdown`, `theme`, `conversation-label`, `suggestions`, `contrast`, todos com teste. (Base de US1 a US4.)
2. **Fronteira de IO**: `api/client`, `chat-stream`, `conversations` com `fetch` falso; `storage/*` com fallback. Inclui prazo de 150 s, `connection_lost` e abort.
3. **Casca e acesso (US1, parte 1)**: roteador, `AccessGate`, `AppShell`, tema, `LiveRegion`, link de pular, estados de carregamento.
4. **Conversa (US1, parte 2)**: `Composer`, `Thread`/`TurnView`/`ToolNotices`, `Markdown`, "Parar", "Copiar", rolagem acompanhando o fim.
5. **Histórico (US2)**: `ConversationList` com paginação e prévia, rota `/c/:id`, "Nova conversa", `EmptyState` com sugestões, `ConfirmDialog` ao trocar durante a resposta, "conversa não encontrada".
6. **Erros e recuperação (US3)**: `StatusNotice`, mensagens por `kind`, contagem regressiva do `429`, "Tentar novamente", preservação do rascunho, retorno à tela de acesso com a pergunta mantida, erros isolados por seção.
7. **Conforto e aceite (US4)**: responsivo e folha do histórico, ajustes de foco e movimento reduzido, teste de tokens, E2E por história com axe nos dois temas e nas três larguras, revisão visual contra o Modernist.

## Complexity Tracking

Não se aplica: nenhuma violação da constitution. A ampliação da escala de espaço (pesquisa, item 11) e a camada de contraste (item 9) são decisões de projeto visual documentadas, não desvios de princípio.
