---

description: "Tarefas da spec 002 — Interface Web do Chat"
---

# Tasks: Interface Web do Chat

**Input**: documentos de design em `specs/002-chat-web-ui/`

**Pré-requisitos**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/api-consumption.md](./contracts/api-consumption.md), [contracts/ui.md](./contracts/ui.md), [quickstart.md](./quickstart.md)

**Testes**: obrigatórios. A constitution (princípio V) exige teste para toda lógica nova, então cada tarefa de implementação inclui o arquivo `*.test.ts`/`*.test.tsx` ao lado do código. Testes de unidade **nunca usam rede**: `fetch`, armazenamento e relógio são injetados como fakes. O E2E fala só com um servidor falso do contrato 001 em `localhost`. A verificação com backend e modelo reais é manual (T074).

**Organização**: por história de usuário, para cada uma ser implementada e validada sozinha.

## Formato: `[ID] [P?] [Story] Descrição com caminho`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[USn]**: história da spec a que a tarefa pertence (só nas fases de história)
- Caminhos relativos à raiz do repositório. Código novo em `web/`; os testes ficam ao lado (`*.test.ts`/`*.test.tsx`), exceto o E2E, que fica em `web/e2e/`
- Comandos: `npm --prefix web run typecheck`, `lint`, `test`, `build`, `test:e2e`
- Cada tarefa cabe em um commit (princípio VIII); `typecheck`, `lint` e `test` verdes antes de cada commit
- **Convenções de código** (constitution + [plan.md](./plan.md)):
  - `src/lib/` é puro: sem React, `fetch`, DOM, `import.meta.env` nem `Date.now()` (o relógio entra por parâmetro). Imports locais com extensão `.ts`/`.tsx`, como no `api/`
  - IO só em `src/api/` e `src/storage/`; `src/hooks/` liga IO ao reducer; `src/components/` e `src/pages/` são finos
  - Estilo de componente em `Componente.module.css` ao lado do `.tsx`; `src/styles/app.css` guarda só globais. Nenhum hex, `px`, `rgb()` ou `font-family` literal fora de `modernist.css` e `app-tokens.css`; use `var(--...)`. Consultas de mídia em `rem`
  - Todo texto da interface em pt-BR, conforme [contracts/ui.md](./contracts/ui.md). Ícones Lucide com `aria-hidden` quando decorativos; botão só de ícone leva `aria-label`
  - Nunca ler nem commitar `.env`; a chave de acesso nunca vai a URL, log, `VITE_*` nem mensagem de erro

---

## Phase 1: Setup

**Propósito**: esqueleto do pacote `web/`.

- [X] T001 Criar `web/package.json` (`"name": "dksoft-ia-chat-web"`, `"private": true`, `"type": "module"`, `engines.node` `>=22.22`; scripts `dev` = `vite`, `build` = `vite build`, `preview` = `vite preview`, `typecheck` = `tsc --noEmit`, `lint` = `oxlint -c .oxlintrc.json src e2e`, `test` = `node --import tsx --import ./src/testing/register-css.ts --test "src/**/*.test.ts" "src/**/*.test.tsx"`, `pretest:e2e` = `npm run build`, `test:e2e` = `node --import tsx --test "e2e/**/*.test.ts"`, `fake-api` = `node --import tsx e2e/fake-api.ts`; dependências `react`, `react-dom`, `react-router`, `zod`, `react-markdown`, `remark-gfm`, `lucide-react`, `@fontsource/archivo`; dev `vite`, `@vitejs/plugin-react`, `typescript`, `tsx`, `@types/node`, `@types/react`, `@types/react-dom`, `oxlint`, `playwright`, `@axe-core/playwright`, nas versões do [plan.md](./plan.md) e `zod` `^3.25.76`, `typescript` `^5.9.3`) e rodar `npm --prefix web install`
- [X] T002 Criar `web/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `target` ES2023, `lib` `["ES2023","DOM","DOM.Iterable"]`, `module` ESNext, `moduleResolution` Bundler, `jsx` `react-jsx`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, `noEmit`, `types` `["vite/client","node"]`, `include` `["src","e2e","vite.config.ts"]`), `web/vite.config.ts` (`@vitejs/plugin-react`, porta 5173 com `strictPort`), `web/index.html` (`lang="pt-BR"`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>Assistente DKSOFT</title>`, `<script src="/theme-init.js"></script>` **antes** do módulo, `<div id="root">`, `<script type="module" src="/src/main.tsx">`), `web/src/vite-env.d.ts` e um `web/src/main.tsx` provisório que renderiza `<div>Assistente DKSOFT</div>`; confirmar que `npm --prefix web run build` e `typecheck` passam
- [X] T003 [P] Criar `web/.oxlintrc.json` a partir da configuração de aderência do design system (plugins `react` e `import`; regra `no-restricted-syntax` como `warn` com os seletores `Literal[value=/#[0-9a-fA-F]{3,8}\b/]` ("Raw hex color — use a design-system color token via var()."), `Literal[value=/\b\d+px\b/]` ("Raw px value — use a design-system spacing token via var().") e `Literal[value=/font-family\s*:\s*(?!['\"]?(?:Archivo))/i]` ("Font not provided by the design system. Available: Archivo.")). **Se o oxlint não suportar `no-restricted-syntax`**, manter só os plugins e deixar a varredura de literais para o teste de T027, registrando a decisão em um comentário no topo de `web/src/styles/tokens.test.ts`; rodar `npm --prefix web run lint` e confirmar que passa
- [X] T004 [P] Criar `web/src/styles/modernist.css`, cópia **vendorizada** do `styles.css` do design system Modernist (ler o documento `styles.css` do projeto "Dksoft MCP" com a ferramenta de Projects; se indisponível, pedir o arquivo à pessoa), com **uma única alteração**: remover a linha `@import url('https://fonts.googleapis.com/...')`. Criar `web/src/styles/fonts.css` com os imports de `@fontsource/archivo/400.css`, `600.css` e `800.css`. Acrescentar no topo de `modernist.css` o comentário "Cópia vendorizada do design system Modernist; não editar. Única alteração: sem @import do Google Fonts. Ver specs/002-chat-web-ui/research.md, item 8"
- [X] T005 [P] Criar `web/public/theme-init.js` (script de poucas linhas, sem dependências: lê `localStorage` `dksoft.theme` dentro de `try/catch`; se for `light` ou `dark`, define `document.documentElement.dataset.theme`; se for `system` ou ausente, remove o atributo) e `web/public/favicon.svg` (marca simples em `currentColor` com `prefers-color-scheme`, sem hex além do acento `#ec3013`)
- [X] T006 [P] Criar `web/.env.example` (`VITE_API_BASE_URL=http://localhost:3000`, com comentário "público: entra no bundle; nunca coloque chave aqui") e conferir/atualizar o `.gitignore` da raiz com `web/dist/`, `web/.env`, `web/node_modules/`, `web/test-results/`
- [X] T007 [P] Atualizar `CLAUDE.md` (em "Estrutura", trocar "`web/` — … a criar" por a descrição real; em "Comandos", acrescentar os comandos do `web/`; manter a constitution consistente) e `README.md` (trocar "O front (`web/`) é uma spec futura" por como subir o front, apontando para [quickstart.md](./quickstart.md))

---

## Phase 2: Foundational (bloqueia todas as histórias)

**Propósito**: tokens e camada de estilo, domínio puro com fixtures e testes, fronteira de IO e componentes de base compartilhados.

**⚠️ CRÍTICO**: nenhuma história começa antes do fim desta fase.

### Estilo e tokens

- [X] T008 Criar `web/src/styles/app-tokens.css` (depende de T004): o único arquivo, além de `modernist.css`, onde hex é permitido. Em `:root` (tema claro): `--space-12: 48px`, `--space-16: 64px`, `--target-min: calc(var(--space-12) - var(--space-1))`, `--color-action: var(--color-accent-700)`, `--color-action-hover: var(--color-accent-800)`, `--color-action-pressed: var(--color-accent-900)`, `--color-on-action: var(--color-bg)`, `--color-border-control: var(--color-neutral-600)`, `--color-text-muted: var(--color-neutral-700)`, `--color-focus: var(--color-accent)`, `--color-icon-alert: var(--color-accent-700)`, `color-scheme: light dark`. Tema escuro (valores já existentes no DS): `--color-bg: #201e1d`, `--color-surface: #2d2b2b`, `--color-surface-raised: var(--color-neutral-800)`, `--color-text: #f3f2f2`, `--color-divider: color-mix(in srgb, #f3f2f2 40%, transparent)`, `--color-action: var(--color-accent-500)`, `--color-action-hover: var(--color-accent-400)`, `--color-action-pressed: var(--color-accent-300)`, `--color-on-action: var(--color-bg)`, `--color-border-control: color-mix(in srgb, var(--color-text) 60%, transparent)`, `--color-text-muted: var(--color-neutral-400)`, `--color-focus: var(--color-accent-500)`, `--color-icon-alert: var(--color-accent-400)`, `--shadow-sm/md/lg: none`. O bloco escuro aparece **duas vezes**, porque CSS não compartilha: em `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` e em `:root[data-theme="dark"] { … }`. Valores e razões de contraste em [research.md](./research.md), itens 9 a 12
- [X] T009 Criar `web/src/styles/app.css` (depende de T008) com os **globais**: correções dos componentes do DS por tokens (`.btn-primary` com `--color-action`/`--color-on-action` e hover/pressed; `a` e `.btn-ghost` com `--color-action`; borda de `.btn-secondary`, `.input` e `.seg` com `--color-border-control`; `.seg-opt:has(input:checked)` com `--color-action`; `.text-muted`, `figcaption`, `.card-meta`, `.table th` e `.field > label` com `--color-text-muted`; `:focus-visible` com `--color-focus`; `min-height: var(--target-min)` em `.btn`, `.input`, `.seg-opt`, `.nav a` e `width`/`height` do `.btn-icon`), mais `.sr-only`, `.skip-link` (visível ao focar), `@media (prefers-reduced-motion: reduce)` que zera `animation` e `transition`, `html { overflow-wrap: anywhere }` onde couber e `body { min-width: 20rem }`. Sem hex nem `px` literais
- [X] T010 [P] Criar `web/src/testing/register-css.ts` e `web/src/testing/css-hooks.mjs`: `register-css.ts` chama `register('./css-hooks.mjs', import.meta.url)` de `node:module`; o hook `load` devolve, para qualquer URL terminada em `.css`, um módulo ESM que exporta `default` como `Proxy` que responde com o próprio nome da chave (`styles.foo === "foo"`) e nada mais, permitindo que testes de componente rodem sob `tsx` sem processar CSS. Teste `web/src/testing/register-css.test.ts` (import de um `.module.css` temporário devolve o proxy; import de efeito colateral `import "./x.css"` não falha)

### Domínio puro (`web/src/lib/`) e fixtures

- [X] T011 [P] Criar `web/src/lib/__fixtures__/` com os exemplos de [contracts/api-consumption.md](./contracts/api-consumption.md): `stream-ok.ts` (texto SSE completo: `meta`, dois `tool`, três `token`, `done`), variações (`stream-crlf`, `stream-split-mid-frame` como lista de pedaços, `stream-done-partial`, `stream-error-<code>` para cada `code`, `stream-no-terminal`, `stream-unknown-event`, `stream-bad-data`), `http-errors.ts` (corpo de cada status 400/401/403/404/429/500), `conversations.ts` (página cheia de 20 e página curta) e `messages.ts` (par `user`/`assistant`). Exportar tudo como constantes tipadas; sem teste próprio (são insumo dos demais)
- [X] T012 [P] Criar `web/src/lib/sse.ts` (`createSseDecoder()` pura: `feed(chunk: string): SseFrame[]` e `flush()`; tolera quadros partidos entre pedaços, `\r\n` e `\n`, várias linhas `data:` (unidas por `\n`), linhas de comentário (`:`) e campos desconhecidos; `SseFrame = { event: string, data: string }`; quadro sem `data:` é descartado) e `web/src/lib/sse.test.ts` com as fixtures de T011 (incluindo um quadro partido em cada posição possível do texto)
- [X] T013 [P] Criar `web/src/lib/events.ts` (depende de T011) com os schemas zod de [data-model.md](./data-model.md#tipos-validados-na-fronteira-zod): `StreamEventSchema` (união discriminada por `event`; `done.model` aceita `null`), `StreamErrorCode`, `ApiErrorBodySchema`, `ConversationSummarySchema`, `ConversationPageSchema`, `ChatMessageSchema`, `MessagesResponseSchema`, e `parseStreamFrame(frame): StreamEvent | "ignored"` (evento desconhecido → `"ignored"`; evento conhecido com `data` inválido → lança `UnexpectedResponseError`, definida em `web/src/lib/errors.ts` por T015 via tipo — evitar ciclo exportando a classe de um arquivo `web/src/lib/failures.ts` próprio, criado nesta tarefa) e `web/src/lib/events.test.ts` (cada evento, `partial`, `model: null`, campo extra ignorado, `code` desconhecido rejeitado)
- [X] T014 [P] Criar `web/src/lib/validation.ts` (`validateMessage(raw)` → `{ ok: true, text } | { ok: false, reason: "empty" | "too_long", excess?: number }` com `trim` e `text.length` em unidades UTF-16, limite 4000; `showCounter(length)` verdadeiro a partir de 3600; `isUuid(value)` por regex 8-4-4-4-12 hexadecimais, qualquer versão) e `web/src/lib/validation.test.ts` (vazio, só espaços, 4000 exatos, 4001, mensagem de 2001 emojis que o servidor recusaria, UUID válido, inválido, maiúsculas)
- [X] T015 [P] Criar `web/src/lib/errors.ts` (depende de T013): tipo `UserError` e `toUserError(input)` pura, cobrindo **todas** as linhas da tabela "Tradução de erros" de [data-model.md](./data-model.md#tradução-de-erros-resumo) com os títulos e mensagens exatos de [contracts/ui.md](./contracts/ui.md#mensagens-de-erro-pt-br); a entrada é uma união discriminada (`{ source: "http", status, body? }`, `{ source: "stream", code, requestId }`, `{ source: "client", kind }`, `{ source: "network" }`); ignora `message` do evento `error` e `issues` do `400`; `supportCode` = `requestId` quando existir; `rate_limited` usa `retryAfterSeconds` (padrão 60); variante "durante o uso" do `unauthorized` por parâmetro `context: "gate" | "session"`. Teste `web/src/lib/errors.test.ts` (uma asserção por `kind`, ausência de texto cru da API, nunca contém chave nem dado pessoal)
- [X] T016 [P] Criar `web/src/lib/join-tokens.ts` (`joinTokens(buffer: string[]): string` e `createTokenBuffer()` pura com `push`/`drain`, para o hook descarregar uma vez por quadro de animação) e `web/src/lib/join-tokens.test.ts` (ordem, esvaziamento, buffer vazio)
- [X] T017 [P] Criar `web/src/lib/scroll-follow.ts` (`shouldFollow({ scrollTop, clientHeight, scrollHeight }, tolerance = 48): boolean`) e `web/src/lib/scroll-follow.test.ts` (no fim, a 48 px, a 49 px, conteúdo menor que a janela)
- [X] T018 [P] Criar `web/src/lib/countdown.ts` (`remainingSeconds(now: number, deadline: number): number` com piso 0 e teto de inteiros para cima; `deadlineFrom(now, seconds)`; `shouldAnnounce(prev, next)` verdadeiro a cada 15 s e ao zerar) e `web/src/lib/countdown.test.ts`
- [X] T019 [P] Criar `web/src/lib/theme.ts` (`ThemePreference`, `parseThemePreference(raw)` com padrão `system`, `resolveTheme(pref, systemDark): "light" | "dark"`, `nextPreference(pref)`) e `web/src/lib/theme.test.ts` (valor inválido vira `system`, todas as combinações)
- [X] T020 [P] Criar `web/src/lib/conversation-label.ts` (`previewOf(text, max = 60)` que normaliza espaços e corta com reticências sem partir palavra no meio quando possível; `formatConversationDate(iso, now, locale = "pt-BR")` pura com o relógio por parâmetro: "Hoje, 14:32", "Ontem, 09:10", "28 out, 16:45", e com ano se for de outro ano; data inválida devolve texto vazio) e `web/src/lib/conversation-label.test.ts`
- [X] T021 [P] Criar `web/src/lib/suggestions.ts` (as 5 sugestões de [contracts/ui.md](./contracts/ui.md#estado-vazio-do-chat-sem-mensagens), sem datas fixas) e `web/src/lib/suggestions.test.ts` (5 itens, únicos, nenhum acima de 4000 caracteres, nenhum com ano ou data literal)
- [X] T022 [P] Criar `web/src/lib/contrast.ts` (`parseColor(css)`, `compose(fg, alpha, bg)`, `contrastRatio(a, b)` pelo WCAG 2.1) e `web/src/lib/contrast.test.ts` com os valores de referência de [research.md, item 9](./research.md#9-achados-de-acessibilidade-do-ds-contraste-calculado) (texto sobre fundo 14,86; acento sobre fundo 3,76; acento-700 sobre fundo 6,41; divisor 40 % sobre fundo 2,41; muted 55 % sobre fundo 3,65), tolerância de 0,01
- [X] T023 Criar `web/src/lib/chat-reducer.ts` (depende de T013, T015) com os tipos `Turn`, `TurnStatus`, `ToolNotice` de [data-model.md](./data-model.md#entidades-do-cliente) e o reducer puro das ações de **turno**: `SEND`, `META`, `TOOL_START`, `TOOL_END` (fecha o aviso `running` mais antigo de mesmo `name`; `end` sem `start` cria o aviso já fechado), `TOKENS`, `DONE`, `ERROR`, `ABORT`, `RESET`. Regras: um só turno ativo; estados terminais descartam eventos atrasados; `ERROR` e `ABORT` mantêm o texto parcial; `DONE` grava `partial`, `model`, `requestId`. Teste `web/src/lib/chat-reducer.test.ts` percorrendo a máquina de estados do [data-model.md](./data-model.md#máquina-de-estados-do-turno) (caminho feliz, parcial, erro HTTP antes do `meta`, erro no meio com texto, interrupção, evento após terminal, duas consultas da mesma ferramenta, `SEND` durante turno ativo é ignorado)

### Fronteira de IO

- [X] T024 Criar `web/src/api/client.ts` (depende de T013, T015): `createApiClient({ baseUrl, getKey, fetch, onUnauthorized })` com `request(path, init)` que adiciona `Authorization: Bearer <chave>` e devolve JSON validado por um schema recebido; em resposta não-`2xx` lê o corpo com `ApiErrorBodySchema`, e lança `ApiFailure` (classe de `web/src/lib/failures.ts`) com a entrada para `toUserError`; `fetch` que rejeita vira `source: "network"`; corpo de sucesso fora do schema vira `unexpected_response`; um `401` chama `onUnauthorized()` antes de lançar. A URL base é parâmetro: **nada de `import.meta.env` aqui**. Teste `web/src/api/client.test.ts` com `fetch` falso (cabeçalho enviado, cada status do contrato, corpo não JSON, rede fora, chave ausente)
- [X] T025 [P] Criar `web/src/storage/access-key.ts` (`createAccessKeyStore(storage = sessionStorage)` com `get`/`set`/`clear` e `persisted: boolean`; todo acesso em `try/catch`; se o armazenamento lançar ou não existir, usa memória e marca `persisted = false`; chave de armazenamento `dksoft.accessKey`) e `web/src/storage/access-key.test.ts` com armazenamentos falsos (normal, que lança, ausente, chave vazia)
- [X] T026 [P] Criar `web/src/storage/theme-preference.ts` (`localStorage`, chave `dksoft.theme`, mesmo padrão de fallback; usa `parseThemePreference` de T019) e `web/src/storage/theme-preference.test.ts`

### Guarda de tokens

- [X] T027 Criar `web/src/styles/tokens.test.ts` (depende de T008, T009, T022). **Varredura**: em todo `web/src/**/*.css` (exceto `modernist.css` e `app-tokens.css`) reprovar hex, `rgb(`, `hsl(`, `\d+px` (inclui `0px`; use `0`), `font-family` que não use `var(--font-`, `border-radius` diferente de `0` ou `var(--radius-*)` e `@media` com `px`; em `web/src/**/*.{ts,tsx}` (exceto testes, `__fixtures__` e `lib/contrast.ts`) reprovar literais de string com hex ou `\d+px`. **Contraste**: ler as declarações de `modernist.css` e `app-tokens.css`, resolver `var()` e `color-mix(... X%, transparent)` por um resolvedor mínimo, e checar, nos temas claro e escuro, os pares de [research.md](./research.md#9-achados-de-acessibilidade-do-ds-contraste-calculado): `--color-text` sobre `--color-bg` e `--color-surface` (≥ 4,5), `--color-on-action` sobre `--color-action`, `-hover` e `-pressed` (≥ 4,5), `--color-action` sobre `--color-bg` (≥ 4,5), `--color-text-muted` sobre bg e surface (≥ 4,5), `--color-border-control` sobre bg e surface (≥ 3), `--color-focus` sobre bg (≥ 3), `--color-icon-alert` sobre bg e surface (≥ 3). Um token que regrida deve fazer o teste falhar com o nome do par
- [X] T028 [P] Criar `web/src/hooks/useAnnouncer.ts` e `web/src/components/LiveRegion.tsx` (região `aria-live="polite"` e `aria-atomic="true"`, classe `.sr-only`, fornecida por contexto `AnnouncerProvider`; `announce(text)` limpa e reescreve a região em dois quadros para repetir o mesmo texto; `alert(text)` usa uma segunda região `role="alert"`) e `web/src/components/LiveRegion.test.tsx` (`renderToStaticMarkup`: atributos das duas regiões)
- [X] T029 [P] Criar `web/src/components/Skeleton.tsx` + `Skeleton.module.css` (blocos retos no formato do conteúdo, `aria-hidden`, com um rótulo `.sr-only` "Carregando…" único por grupo; sem animação sob movimento reduzido; atraso de 300 ms **por CSS** `animation-delay`/`visibility`, para não piscar em cargas rápidas) e `web/src/components/Skeleton.test.tsx`
- [X] T030 [P] Criar `web/src/components/StatusNotice.tsx` + `StatusNotice.module.css` (depende de T009): variantes `error` (ícone `circle-alert`, rótulo "Erro"), `warning` (`triangle-alert`, "Aviso") e `interrupted` (`octagon-x`, "Interrompida"); moldura de 2 px em `--color-text`, ícone com `--color-icon-alert`, rótulo textual, título, mensagem e slot de ações; `role="alert"` só na variante `error`; sem depender de cor para distinguir as variantes. Teste `web/src/components/StatusNotice.test.tsx` (cada variante tem ícone, rótulo e texto; `role` correto; nenhum hex no módulo CSS)

**Checkpoint**: `npm --prefix web run typecheck`, `lint`, `test` e `build` verdes; a base está pronta para as histórias.

---

## Phase 3: User Story 1 — Entrar e perguntar, vendo a resposta chegar aos poucos (Priority: P1) 🎯 MVP

**Goal**: a pessoa informa a chave, faz uma pergunta e vê a resposta em partes, com avisos de consulta, podendo interromper e copiar.

**Independent Test**: com o servidor falso (T043), abrir sem chave (só a tela de acesso), errar e acertar a chave, enviar uma pergunta e conferir pergunta imediata, avisos, texto em partes, "Parar", "Copiar" e a ausência da chave em tela, URL e armazenamento ([quickstart.md](./quickstart.md#us1-entrar-e-perguntar-sc-001-sc-002-sc-003-sc-006)).

### Fronteira e lógica

- [ ] T031 [P] [US1] Criar `web/src/api/chat-stream.ts` (depende de T012, T013, T015, T024): `streamChat({ client, message, conversationId, signal, deadlineMs = 150000, setTimer, clearTimer })` devolve `AsyncIterable<StreamEvent>`; faz `POST /chat` com `Accept: text/event-stream`, lê `response.body` com `TextDecoder` em modo `stream`, alimenta `createSseDecoder`, valida cada quadro com `parseStreamFrame` (descarta `"ignored"`), encerra o iterável depois do primeiro evento terminal; erro HTTP antes do stream vira `ApiFailure`; fim do corpo sem terminal lança `connection_lost`; estouro do prazo aborta e lança `client_timeout`; `signal` abortado pelo chamador encerra sem erro com a marca `aborted`. Timers injetáveis para teste. Teste `web/src/api/chat-stream.test.ts` com `Response`/`ReadableStream` falsos (caminho feliz em pedaços de 1 byte, `\r\n`, erro no meio, corte sem terminal, prazo estourado, abort, 401/403/404/429/500, evento desconhecido ignorado, `data` inválido → `unexpected_response`)
- [ ] T032 [P] [US1] Criar `web/src/api/access.ts` (`validateAccessKey({ baseUrl, key, fetch })`: `GET /conversations?limit=1` com a chave candidata; `200` → `{ ok: true }`; `401` → `{ ok: false, error: toUserError(unauthorized, "gate") }`; demais falhas → `{ ok: false, error }` com o `UserError` correspondente) e `web/src/api/access.test.ts` (200, 401, 403, 429, 500, rede fora, corpo inválido; a chave só vai no cabeçalho)
- [ ] T033 [P] [US1] Criar `web/src/hooks/run-turn.ts` (função **não React**, testável: `runTurn({ stream, dispatch, schedule, cancelSchedule, announce })` consome o `AsyncIterable` de `streamChat`, traduz cada evento em ação do reducer, acumula `token` em `createTokenBuffer` e descarrega via `schedule` (um quadro de animação injetado), anuncia o `label` de cada consulta, "Resposta concluída." e "Resposta interrompida."; trata exceção de `ApiFailure` com `toUserError`; retorna o `conversationId` do `meta`) e `web/src/hooks/run-turn.test.ts` com stream falso e agendador manual (lote de tokens, ordem de ações, erro no meio, abort, anúncios)

### Componentes

- [ ] T034 [P] [US1] Criar `web/src/components/Markdown.tsx` + `Markdown.module.css` (`react-markdown` com `remark-gfm`, **sem** `rehype-raw`; `a` com `target="_blank"` e `rel="noopener noreferrer"`; `table` envolta em bloco rolável horizontalmente com `tabIndex={0}`, `role="region"` e `aria-label="Tabela da resposta"`; `pre`/`code` com quebra controlada; `React.memo` por texto) e `web/src/components/Markdown.test.tsx` com `renderToStaticMarkup`: `<script>` e `<img onerror>` saem como texto escapado, `[x](javascript:alert(1))` não vira link ativo, HTML bruto não é interpretado, tabela GFM vem dentro do bloco rolável, link externo recebe `rel`
- [ ] T035 [P] [US1] Criar `web/src/hooks/useAccessKey.ts` (estado da chave sobre `createAccessKeyStore`, `signIn(key)` que chama `validateAccessKey` e só então guarda, `signOut()`), `web/src/components/AccessGate.tsx` + `AccessGate.module.css` (tela de acesso de [contracts/ui.md](./contracts/ui.md#tela-de-acesso): `h1` "Acesso ao chat", campo `type="password"` com `autocomplete="off"` e rótulo, erro inline ligado por `aria-describedby`, botão principal "Entrar" com `aria-busy` e rótulo "Verificando…", campo preservado em erro; propriedade `reason` opcional para a mensagem de sessão expirada de US3) e `web/src/components/AccessGate.test.tsx` (rótulo associado, `aria-describedby` só com erro, nenhum valor da chave ecoado no HTML)
- [ ] T036 [P] [US1] Criar `web/src/components/ToolNotices.tsx` + `ToolNotices.module.css` (lista de `ToolNotice`: em andamento com `loader-circle` girando, concluída com `check`, falhou com `x`; sempre ícone **e** texto do `label`; giro desligado sob `prefers-reduced-motion`) e `web/src/components/ToolNotices.test.tsx` (as três fases, ícone e texto presentes, lista vazia não renderiza nada)
- [ ] T037 [P] [US1] Criar `web/src/components/Composer.tsx` + `Composer.module.css` (`textarea` rotulada "Pergunta" que cresce até 6 linhas; contador visível a partir de `showCounter`, com o excesso em texto quando passar de 4000; botão principal "Enviar" com ícone `send` após o rótulo e rótulo alinhado à esquerda; botão secundário "Parar" visível só durante a resposta; `Enter` envia, `Shift+Enter` quebra linha; texto de apoio do atalho ligado por `aria-describedby`; `actions` como slot para o futuro controle de voz; envio bloqueado com texto inválido, mostrando o motivo junto ao campo; props `value`/`onChange` controladas por quem usa, para o rascunho sobreviver) e `web/src/components/Composer.test.tsx` (rótulo, `aria-describedby`, "Parar" só quando ativo, contador a partir de 3600, aviso de excesso, alvo mínimo vindo do token)
- [ ] T038 [US1] Criar `web/src/hooks/useChat.ts` (depende de T023, T031, T033): `useReducer(chatReducer)` mais `send(text)`, `stop()` e `reset()`; cria um `AbortController` por turno, usa `runTurn` com `requestAnimationFrame`, expõe `turns`, `activeTurn`, `conversationId` (do `meta`) e `isBusy`; impede segundo envio enquanto houver turno ativo
- [ ] T039 [P] [US1] Criar `web/src/components/TurnView.tsx` + `TurnView.module.css` (depende de T030, T034, T036): bloco do turno com régua de 2 px, rótulos "Você" (pergunta) e "Assistente" (alinhados à esquerda, estilo `h6` do DS, sem balões), `ToolNotices`, texto em `Markdown` com `aria-busy` enquanto chega, indicador "Consultando…" no estado `pending`, `StatusNotice` de parcial (`warning`, com o texto de [contracts/ui.md](./contracts/ui.md#turno-do-assistente-elementos)) e de interrompida, botão "Copiar" (com `navigator.clipboard`, vira "Copiado" por 2 s e anuncia "Resposta copiada."; oculto se a API de área de transferência não existir) e o nome do modelo em `figcaption` discreto; teste `web/src/components/TurnView.test.tsx` (cada estado do turno, parcial, interrompida, ausência de "Copiar" sem texto concluído)
- [ ] T040 [US1] Criar `web/src/hooks/useAutoFollow.ts` (usa `shouldFollow` no evento de rolagem; expõe `following`, `scrollToEnd()`) e `web/src/components/Thread.tsx` + `Thread.module.css` (lista de `TurnView` em contêiner rolável; botão "Ir para o fim" (`arrow-down`) quando `following` for falso; enviar pergunta sempre leva ao fim) e `web/src/components/Thread.test.tsx` (botão só quando não acompanha)
- [ ] T041 [US1] Criar `web/src/components/AppShell.tsx` + `AppShell.module.css` (depende de T009, T028): link "Pular para a conversa", `header.nav` do DS (marca "DKSOFT IA", botão "Sair" que chama `signOut`), `main` com `h1` "Assistente DKSOFT", slot `aside` reservado ao histórico (preenchido em US2), `LiveRegion` e `AnnouncerProvider`; pontos de referência `header`/`aside`/`main` corretos; teste `web/src/components/AppShell.test.tsx` (um único `h1`, link de pular aponta para o `id` de `main`, landmarks)
- [ ] T042 [US1] Criar `web/src/pages/ChatPage.tsx`, `web/src/App.tsx` e a raiz de composição em `web/src/main.tsx` (depende de T035, T037, T038, T040, T041): `main.tsx` importa `fonts.css`, `modernist.css`, `app-tokens.css`, `app.css` (nesta ordem), lê `import.meta.env.VITE_API_BASE_URL` **só aqui**, cria o cliente, os repositórios de armazenamento e os provedores; `App.tsx` mostra `AccessGate` sem chave e, com chave, as rotas `/` (e redireciona qualquer outra para `/`); `ChatPage` compõe `Composer` e `Thread` para conversa nova, com o estado vazio simples (texto curto; as sugestões vêm em US2). Ao fim, `npm --prefix web run build` gera `dist/` sem aviso

### E2E

- [ ] T043 [US1] Criar `web/e2e/fake-api.ts` e `web/e2e/helpers.ts`: `fake-api.ts` é um servidor `node:http` do contrato 001 (chave válida de 32+ caracteres combinada com o teste; `401` idêntico para ausente e errada; CORS para `http://localhost:4173` e `5173` com `Authorization`/`Content-Type` permitidos e `X-Request-Id`/`X-Conversation-Id` expostos; `GET /conversations` e `/conversations/:id/messages` com dados semeados; `POST /chat` com SSE roteirizado), com **cenários** selecionáveis pelo teste via `POST /__scenario` e pela linha de comando (`--scenario <nome>`): `ok`, `slow`, `tool-fail`, `partial`, `markdown-table`, `malicious-markdown`, `error-timeout`, `error-model`, `error-tools`, `error-internal`, `cut` (fecha sem terminal), `rate-limited`, `origin-denied`, `server-500`, `bad-body`, `list-fail`. `helpers.ts` abre o `vite preview` e o servidor falso em portas livres, lança o Chromium com a biblioteca `playwright`, aplica tema (`localStorage`) e largura, e expõe `runAxe(page)` com `@axe-core/playwright` nas regras `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Servidores e navegador sobem e caem por teste; só `localhost`
- [ ] T044 [US1] Criar `web/e2e/access.test.ts` e `web/e2e/chat.test.ts` (`node:test`, dependem de T043): acesso — sem chave só a tela de acesso, chave errada mostra erro junto ao campo, chave certa entra, a chave não está no DOM, na URL nem em `localStorage`, e só `dksoft.accessKey` existe em `sessionStorage` (SC-006); chat — pergunta e indicador em até 1 s mesmo com cenário `slow` (SC-001), avisos de consulta com ícone e texto, texto crescendo em partes, "Copiar", "Parar" mantém o texto parcial marcado, envio bloqueado durante a resposta mantendo o texto digitado, "Ir para o fim" ao rolar para cima, tabela GFM rolando dentro do bloco, `markdown-table`/`malicious-markdown` sem execução (SC-011), `partial` com aviso visível

**Checkpoint**: a User Story 1 funciona e é testável sozinha. **MVP.**

---

## Phase 4: User Story 2 — Retomar e continuar conversas anteriores (Priority: P1)

**Goal**: listar, abrir, continuar e iniciar conversas; a conversa aberta vive na URL; sugestões no estado vazio.

**Independent Test**: criar duas conversas, voltar à primeira pela lista, enviar um acompanhamento, recarregar a página e conferir a mesma conversa; abrir ids inexistentes ([quickstart.md](./quickstart.md#us2-retomar-conversas-sc-007)).

- [ ] T045 [P] [US2] Criar `web/src/api/conversations.ts` (depende de T013, T024): `listConversations(client, { limit, offset })` e `getMessages(client, id)` validados por `ConversationPageSchema` e `MessagesResponseSchema`; `getMessages` com id não UUID lança `conversation_not_found` **sem chamar a rede** (usa `isUuid`) e `web/src/api/conversations.test.ts` (parâmetros na URL, páginas cheia e curta, `404`, `401`, id inválido sem `fetch`)
- [ ] T046 [US2] Estender `web/src/lib/chat-reducer.ts` (depende de T023) com `ConversationView` e as ações `LOAD_START`, `LOAD_OK(messages)`, `LOAD_ERROR(err)`, `LOAD_NOT_FOUND`, e a função pura `messagesToTurns(messages)` (cada par `user`/`assistant` vira um turno `done`; `user` sem `assistant` vira turno `done` de texto vazio); `SEND` em conversa `not-found` é ignorado. Estender `web/src/lib/chat-reducer.test.ts` (carga, vazio, erro, não encontrada, pares, mensagem solta, ordem preservada, conversa nova após `RESET`)
- [ ] T047 [P] [US2] Criar `web/src/lib/conversation-list.ts` (reducer puro de `ConversationListState` de [data-model.md](./data-model.md#entidades-do-cliente): `LOAD_START`, `LOAD_OK(page)`, `LOAD_MORE_START`, `LOAD_MORE_OK(page)`, `LOAD_ERROR`; `hasMore` verdadeiro quando a página vem com `limit` itens; `empty` quando a primeira página vem vazia; páginas acrescentadas sem duplicar ids) e `web/src/lib/conversation-list.test.ts`
- [ ] T048 [P] [US2] Criar `web/src/hooks/preview-queue.ts` (`createPreviewQueue({ getMessages, concurrency = 2, onUpdate })` não React: enfileira ids, busca a primeira mensagem `user` com `previewOf`, guarda em `Map` em memória, `null` quando falha, não busca duas vezes o mesmo id, cancelável) e `web/src/hooks/preview-queue.test.ts` com `getMessages` falso (concorrência nunca passa de 2, falha vira `null`, cache, cancelamento)
- [ ] T049 [US2] Criar `web/src/hooks/useConversation.ts` (depende de T045, T046): carrega o histórico de um `conversationId` com `getMessages`; `404` ou id não UUID → `LOAD_NOT_FOUND` sem chamar a rede; `401` aciona o `onUnauthorized` do cliente; expõe `view` (fase e turnos) e `reload()`
- [ ] T050 [US2] Criar `web/src/hooks/useConversationList.ts` e `web/src/hooks/useConversationPreview.ts` (depende de T045, T047, T048): paginação de 20 em 20 com `loadMore()`, `reload()`, atualização da lista quando uma conversa nova recebe o `meta`; a prévia é pedida só para itens visíveis (via `IntersectionObserver` quando houver, senão todos da página)
- [ ] T051 [P] [US2] Criar `web/src/components/ConfirmDialog.tsx` + `ConfirmDialog.module.css` (`<dialog>` nativo com `showModal()`, `Esc` fecha, foco volta ao elemento que abriu; props `title`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`; foco inicial no botão secundário; usa as classes `.dialog` do DS) e `web/src/components/ConfirmDialog.test.tsx` (atributos, ordem dos botões, textos de [contracts/ui.md](./contracts/ui.md#confirmação-ao-trocar-de-conversa-durante-uma-resposta-fr-026))
- [ ] T052 [P] [US2] Criar `web/src/components/EmptyState.tsx` + `EmptyState.module.css` (`h2` "O que você quer saber?", parágrafo sobre o que o assistente consulta e as 5 sugestões de `lib/suggestions.ts` como botões em `.card`; acionar uma sugestão **preenche o campo e foca nele, sem enviar**, via callback `onPick(text)`) e `web/src/components/EmptyState.test.tsx` (5 botões com nome acessível igual ao texto)
- [ ] T053 [US2] Criar `web/src/components/ConversationList.tsx` + `ConversationList.module.css` (depende de T029, T030, T050): `h2` "Conversas", botão "Nova conversa" no topo, itens como links nativos para `/c/:id` com data/hora (`formatConversationDate`) e a prévia quando houver, `aria-current="true"` na conversa aberta, "Carregar mais" ao fim (some quando `hasMore` for falso), e os quatro estados de [contracts/ui.md](./contracts/ui.md#estados-por-componente) (esqueleto de 5 linhas, vazio com a próxima ação, erro com "Tentar novamente", sucesso); teste `web/src/components/ConversationList.test.tsx` (cada estado, `aria-current`, rótulo sem prévia, botão "Carregar mais" condicional)
- [ ] T054 [US2] Ligar a URL e a conversa em `web/src/App.tsx` e `web/src/pages/ChatPage.tsx` (depende de T042, T049): rotas `/` e `/c/:conversationId` (id inválido ou inexistente → `StatusNotice` "Conversa não encontrada" com "Iniciar nova conversa"); ao chegar o `meta` de uma conversa nova, `navigate("/c/<id>", { replace: true })`; "Nova conversa" volta a `/` e faz `RESET`; trocar de conversa carrega o histórico em esqueleto → turnos; estado vazio passa a usar `EmptyState`
- [ ] T055 [US2] Montar o histórico no `aside` de `AppShell` e a confirmação de troca (depende de T051, T053, T054): `ChatPage` preenche o slot com `ConversationList`; se houver turno ativo ao trocar de conversa ou acionar "Nova conversa", abre `ConfirmDialog` ("Interromper a resposta?") e só prossegue (com `stop()`) se a pessoa confirmar (FR-026); a conversa aberta fica marcada na lista
- [ ] T056 [US2] Criar `web/e2e/history.test.ts` (depende de T043, T055): lista com mais recente primeiro e prévias, "Carregar mais" até a página curta, abrir conversa e ver mensagens em ordem, continuar a conversa, "Nova conversa", recarregar reabre a mesma conversa e a URL é `/c/<uuid>` (SC-007), `/c/abc` e UUID inexistente mostram "Conversa não encontrada", lista vazia com a próxima ação, sugestão só preenche o campo, troca durante resposta abre a confirmação

**Checkpoint**: as Histórias 1 e 2 funcionam; o conjunto P1 está completo.

---

## Phase 5: User Story 3 — Entender e se recuperar quando algo falha (Priority: P2)

**Goal**: cada falha vira mensagem humana com ação e código de suporte, sem perder o que a pessoa digitou.

**Independent Test**: simular cada resposta de erro e cada falha de conexão com os cenários do servidor falso e conferir mensagem, ação e rascunho preservado ([quickstart.md](./quickstart.md#us3-erros-e-recuperação-sc-004-sc-005)).

- [ ] T057 [P] [US3] Criar `web/src/components/ErrorPanel.tsx` + `ErrorPanel.module.css` e `web/src/hooks/useCountdown.ts` (depende de T015, T018, T030): compõe `StatusNotice` com título e mensagem do `UserError`, botão "Tentar novamente" quando `action === "retry"`, "Iniciar nova conversa" quando `new-conversation`, "Informar a chave de novo" quando `reauthenticate`, contagem regressiva de `retryAfterSeconds` quando `wait` (anuncia de 15 em 15 s e ao zerar "Você já pode enviar de novo."), e "Código de suporte: <id>" com botão "Copiar código" quando houver `supportCode`; `useCountdown` usa `remainingSeconds` com o relógio injetado. Teste `web/src/components/ErrorPanel.test.tsx` (uma asserção por `action`, código de suporte presente/ausente, nenhuma string de erro cru)
- [ ] T058 [P] [US3] Criar `web/src/hooks/DraftContext.tsx` (provedor em memória do rascunho e do último envio, colocado **acima** de `AccessGate` em `main.tsx`, para sobreviver à volta à tela de acesso; `draft`, `setDraft`, `lastSent`) e `web/src/hooks/DraftContext.test.tsx` (rascunho mantido ao desmontar e remontar os filhos; nada gravado em armazenamento)
- [ ] T059 [US3] Implementar o retorno à tela de acesso (depende de T035, T057, T058): o `onUnauthorized` do cliente (T024) limpa a chave e leva ao `AccessGate` com `reason="session"` ("Sua sessão expirou", rascunho preservado); ao entrar de novo a pessoa volta à mesma rota com a pergunta ainda no campo; teste em `web/src/components/AccessGate.test.tsx` para a mensagem de sessão expirada
- [ ] T060 [US3] Implementar nova tentativa e bloqueio por limite de uso em `web/src/hooks/useChat.ts` e `web/src/pages/ChatPage.tsx` (depende de T038, T057, T058): "Tentar novamente" descarta o turno com erro e reenvia a mesma pergunta na mesma conversa (ação explícita, nunca automática); em `rate_limited` o compositor fica bloqueado até a contagem zerar, mantendo o texto; `invalid_body` mantém o texto para edição; erro no meio mantém o texto parcial e o marca como incompleto; `connection_lost` e `client_timeout` idem. Estender `web/src/hooks/run-turn.test.ts` e `web/src/lib/chat-reducer.test.ts` com esses caminhos
- [ ] T061 [P] [US3] Criar `web/src/components/SectionBoundary.tsx` (limite de erro de React por seção com `ErrorPanel` de `unexpected_response` e "Tentar novamente"; o histórico, a conversa e o compositor ficam em limites separados) e `web/src/components/SectionBoundary.test.tsx` (um filho que lança não derruba o irmão); aplicar em `ChatPage` e no painel de histórico (a falha de listar conversas só afeta o painel, FR-020)
- [ ] T062 [P] [US3] Implementar o aviso discreto de armazenamento bloqueado (`access-key` e `theme-preference` com `persisted === false`): `web/src/components/StorageNotice.tsx` mostra "Seu navegador bloqueou o armazenamento; a chave e o tema não serão lembrados." como `warning` pequeno na barra, sem bloquear o uso, e `web/src/components/StorageNotice.test.tsx` (aparece só com `persisted: false`)
- [ ] T063 [US3] Criar `web/e2e/errors.test.ts` (depende de T043, T059, T060, T061): servidor desligado → "Sem conexão" e texto preservado; `401` no meio do uso → tela de acesso e pergunta mantida após entrar; `origin-denied` → "Endereço não autorizado" com código de suporte; `rate-limited` → contagem e envio liberado ao zerar; `error-timeout`, `error-model`, `error-tools`, `error-internal` com texto parcial mantido e "Tentar novamente" que reenvia; `cut` → "Conexão interrompida" sem espera infinita; `bad-body` → "Resposta inesperada"; `list-fail` → erro só no painel de histórico e chat utilizável; nenhuma tela mostra rastro técnico, `message` cru do servidor nem a chave (SC-004, SC-005)

**Checkpoint**: as Histórias 1, 2 e 3 funcionam.

---

## Phase 6: User Story 4 — Usar com conforto em qualquer tela, tema e modo de interação (Priority: P2)

**Goal**: tema claro/escuro, teclado, leitor de tela, movimento reduzido e layout de 320 px a desktop, no visual Modernist.

**Independent Test**: percorrer o fluxo só com teclado, em 320 px, nos dois temas, com axe em cada tela ([quickstart.md](./quickstart.md#us4-tema-teclado-responsivo-e-leitor-de-tela-sc-008-a-sc-012)).

- [ ] T064 [P] [US4] Criar `web/src/hooks/useTheme.ts` e `web/src/components/ThemeToggle.tsx` + `ThemeToggle.module.css` (depende de T019, T026): `useTheme` lê/grava a preferência, aplica `data-theme` em `<html>` (remove o atributo em `system`), acompanha `matchMedia("(prefers-color-scheme: dark)")`; `ThemeToggle` é um controle segmentado `.seg` com rádios "Sistema", "Claro" e "Escuro" (rótulo de grupo `aria-label="Tema"`), na barra do `AppShell`; teste `web/src/components/ThemeToggle.test.tsx` (três opções, uma marcada, rótulo de grupo)
- [ ] T065 [P] [US4] Criar `web/src/components/HistorySheet.tsx` + `HistorySheet.module.css` (`<dialog>` modal que abriga `ConversationList` em tela estreita; botão "Histórico" na barra com `aria-expanded`/`aria-controls`; fecha ao escolher uma conversa e com `Esc`; foco volta ao botão) e `web/src/components/HistorySheet.test.tsx`
- [ ] T066 [US4] Implementar o layout responsivo em `web/src/components/AppShell.module.css`, `web/src/pages/ChatPage.module.css` e `web/src/styles/app.css` (depende de T055, T065): mínimo de 20 rem; abaixo de 64 rem, uma coluna com o histórico em `HistorySheet` e compositor fixo no pé sem cobrir o campo em digitação; a partir de 64 rem, duas colunas (histórico de 20 a 24 rem) com régua de 2 px entre elas; consultas de mídia em `rem`; sem rolagem horizontal da página; tabelas rolam só dentro do bloco; alinhamento à esquerda e réguas de 2 px do Modernist. Atualizar `AppShell.test.tsx` para os dois modos
- [ ] T067 [P] [US4] Fechar o mapa de teclado e o foco de [contracts/ui.md](./contracts/ui.md#mapa-de-teclado) em `Composer.tsx`, `ChatPage.tsx` e `AppShell.tsx`: `Esc` no compositor aciona "Parar" durante a resposta; foco volta ao compositor após enviar, após erro recuperado e após fechar diálogos; foco no título da conversa ao abrir `/c/:id`; anunciar "Conversa aberta com N mensagens."; verificar `prefers-reduced-motion` em todos os giros e transições; estender os testes de componente correspondentes
- [ ] T068 [US4] Criar `web/e2e/a11y.test.ts` (depende de T043, T064, T066, T067): `runAxe` em cada tela e estado (acesso, acesso com erro, vazio, resposta em andamento, concluída, parcial, interrompida, erro, histórico vazio, histórico com erro, "Conversa não encontrada", folha de histórico, diálogo de confirmação) nos temas claro e escuro, sem violações `critical` ou `serious` (SC-009); fluxo completo só por teclado (entrar, perguntar, parar, abrir histórico, tentar novamente, trocar de tema) sem armadilha de foco (SC-008); região viva anuncia consulta, conclusão e erro sem anunciar o texto token a token
- [ ] T069 [P] [US4] Criar `web/e2e/responsive.test.ts` (depende de T043, T066): em 320, 768 e 1280 px, nenhuma tela com rolagem horizontal da página e todos os alvos interativos com pelo menos 44 por 44 px (SC-010); histórico em folha abaixo de 64 rem e em coluna a partir dele; tabela larga rolando só no bloco; tema segue o do sistema, a escolha manual persiste após recarregar e a primeira pintura já vem no tema certo (sem clarão); movimento reduzido remove os giros
- [ ] T070 [US4] Revisão visual contra o design system Modernist com o checklist de [contracts/ui.md](./contracts/ui.md#revisão-visual-contra-o-modernist-checklist-de-aceite): abrir cada tela nos dois temas, conferir tipografia, grade, cantos retos, réguas de 2 px, rótulos à esquerda, acento só na ação principal, foco e destaques, erro por moldura + ícone + rótulo; registrar o resultado e as correções em `specs/002-chat-web-ui/checklists/visual-review.md` (SC-012) e corrigir o que sair do sistema

**Checkpoint**: as quatro histórias funcionam e são testáveis sozinhas.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Propósito**: garantias que atravessam as histórias.

- [ ] T071 [P] Criar `web/src/security.test.ts`: varredura de `web/src/**/*.{ts,tsx}` (exceto testes) que reprova `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval(`, `new Function`, `document.write`, qualquer uso de `localStorage`/`sessionStorage` fora de `src/storage/`, qualquer `console.*` que receba chave, `Authorization` ou texto de conversa, e qualquer variável `import.meta.env.VITE_*` com nome contendo `KEY`, `TOKEN` ou `SECRET`; e um teste de E2E complementar em `web/e2e/chat.test.ts` que garante que, depois de uma conversa, `localStorage` só tem `dksoft.theme` e `sessionStorage` só tem `dksoft.accessKey` (SC-006, FR-025)
- [ ] T072 [P] Documentar a hospedagem em `README.md` (seção "Front (`web/`)"): `npm --prefix web run build`, fallback para `index.html` em qualquer rota, CSP recomendada e `Referrer-Policy: no-referrer` ([research.md, item 21](./research.md#21-segurança-do-front)), `CHAT_CORS_ORIGINS` com a origem final, e a observação de que `VITE_API_BASE_URL` é público
- [ ] T073 Rodar todos os portões: `npm --prefix web run typecheck`, `lint`, `test`, `build` e `test:e2e` (com `npx --prefix web playwright install chromium` antes), mais `npm --prefix api run typecheck` e `npm --prefix api test` para garantir que nada do `api/` mudou; registrar no corpo do PR o tamanho do bundle gerado por `vite build` e o resultado de cada portão
- [ ] T074 Verificação manual com backend e modelo reais, seguindo [quickstart.md](./quickstart.md) (US1 a US4, passo a passo, com a chave real em `api/.env`; **não automatizada**): cronometrar SC-002, conferir SC-006 no DevTools e uma passada com leitor de tela; anotar divergências como tarefas novas

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Fase 1)**: sem dependências
- **Foundational (Fase 2)**: depende do Setup; **bloqueia todas as histórias**
- **Histórias (Fases 3 a 6)**: dependem da Fase 2
  - **US1** não depende de nenhuma outra história (é o MVP)
  - **US2** usa o `ChatPage`, o `AppShell` e o `useChat` da US1
  - **US3** usa `AccessGate`, `useChat`, `ChatPage` e `ConversationList` (US1 e US2)
  - **US4** usa o `AppShell`, o histórico e os componentes das anteriores; só `ThemeToggle` (T064) é independente
- **Polish (Fase 7)**: depende das histórias desejadas

### Dependências dentro da Fase 2

```text
T001 ─► T002 ─► (T003 T004 T005 T006 T007 em paralelo)
T004 ─► T008 ─► T009 ─► T030
T001 ─► T010
T011 ─► T013 ─► T015 ─► T023, T024
T012 T014 T016 T017 T018 T019 T020 T021 T022 (independentes entre si, depois de T001)
T008 + T009 + T022 ─► T027
T024 ─► (T031, T032, T045)    T025 T026 T028 T029 (independentes)
```

### Dependências entre histórias (grafo resumido)

```text
Fase 2 ─► US1 (T031..T044) ─► US2 (T045..T056) ─► US3 (T057..T063) ─┐
                    │                    └─────────────► US4 (T064..T070) ┴─► Polish (T071..T074)
                    └─ T064 (ThemeToggle) pode começar já após a Fase 2
```

### Dentro de cada história

- Lógica pura e testes antes de hooks, hooks antes de componentes, componentes antes de páginas, páginas antes do E2E
- Cada `[P]` toca arquivos distintos; tarefas que editam o mesmo arquivo (`chat-reducer.ts`, `ChatPage.tsx`, `AppShell.tsx`, `useChat.ts`, `app.css`) **não** são `[P]` entre si
- Teste escrito junto do código na mesma tarefa; o E2E só depois dos componentes da história

## Parallel Opportunities

- **Setup**: T003, T004, T005, T006 e T007 juntos após T002
- **Foundational, domínio puro**: T012, T014, T016 a T022 juntos (arquivos distintos em `web/src/lib/`); T025, T026, T028 e T029 também
- **US1**: T031, T032, T033, T034, T035, T036 e T037 juntos; depois T038 e T039, e então T040 a T042
- **US2**: T045, T047, T048, T051 e T052 juntos
- **US3**: T057, T058, T061 e T062 juntos
- **US4**: T064 e T065 juntos; T068 e T069 juntos ao final

### Exemplo: User Story 1

```bash
# Em paralelo (arquivos distintos):
Task: "T031 api/chat-stream.ts + chat-stream.test.ts"
Task: "T032 api/access.ts + access.test.ts"
Task: "T033 hooks/run-turn.ts + run-turn.test.ts"
Task: "T034 components/Markdown.tsx + Markdown.test.tsx"
Task: "T035 hooks/useAccessKey.ts + components/AccessGate.tsx + AccessGate.test.tsx"
Task: "T036 components/ToolNotices.tsx + ToolNotices.test.tsx"
Task: "T037 components/Composer.tsx + Composer.test.tsx"
```

## Implementation Strategy

### MVP primeiro (somente a User Story 1)

1. Fase 1 (Setup) e Fase 2 (Foundational), com `typecheck`, `lint`, `test` e `build` verdes
2. Fase 3 (US1): entrar, perguntar, ver a resposta em partes, parar e copiar
3. **Parar e validar** a US1 com o servidor falso e, se possível, com o backend real ([quickstart.md](./quickstart.md#us1-entrar-e-perguntar-sc-001-sc-002-sc-003-sc-006))
4. Demonstrar

### Entrega incremental

1. Setup + Foundational: base pronta
2. **US1** → testar → demonstrar (MVP)
3. **US2** → testar → o conjunto P1 está completo e já é utilizável no dia a dia
4. **US3** → testar (robustez para uso real)
5. **US4** → testar (conforto, tema, responsivo e a11y) e fechar o Polish
6. Cada história agrega valor sem quebrar as anteriores

## Cobertura dos requisitos

| Requisito da spec | Tarefas |
|-------------------|---------|
| FR-001, FR-002 (chave e sessão) | T025, T032, T035, T044, T059 |
| FR-003, FR-004 (pergunta e retorno imediato) | T014, T037, T038, T044 |
| FR-005, FR-006 (avisos de consulta e resposta em partes) | T012, T013, T016, T023, T031, T033, T036, T039, T040 |
| FR-007 (uma resposta por vez, interromper) | T023, T037, T038, T044 |
| FR-008, FR-009, FR-010 (Markdown, parcial, copiar) | T034, T039, T044 |
| FR-011, FR-012, FR-013 (histórico, abrir, URL) | T020, T045 a T050, T053, T054, T056 |
| FR-014 (sugestões) | T021, T052, T056 |
| FR-015, FR-016, FR-017 (erros, código de suporte, nova tentativa) | T015, T030, T057, T060, T063 |
| FR-018 (chave recusada em uso) | T024, T058, T059, T063 |
| FR-019 (fim sem sinal terminal) | T031, T063 |
| FR-020 (quatro estados e isolamento) | T029, T053, T061 |
| FR-021 (tema) | T008, T019, T026, T064, T069 |
| FR-022 (acessibilidade AA) | T009, T027, T028, T067, T068 |
| FR-023 (responsivo) | T034, T066, T069 |
| FR-024 (design system) | T003, T004, T008, T009, T027, T070 |
| FR-025 (nada de conversa no navegador) | T025, T026, T058, T071 |
| FR-026 (confirmar troca durante resposta) | T051, T055, T056 |
| SC-001 a SC-012 | [quickstart.md](./quickstart.md#mapa-dos-critérios-de-sucesso), com T044, T056, T063, T068, T069, T070, T071, T074 |

## Notes

- `[P]` = arquivos diferentes, sem dependência de tarefa incompleta
- `[USn]` liga a tarefa à história, para rastreio
- Cada história deve poder ser concluída e testada sozinha (exceção declarada: US2 a US4 reaproveitam os componentes de US1)
- Escrever o teste junto do código; `typecheck`, `lint` e `test` verdes antes de cada commit
- Gráficos e voz **não** fazem parte desta lista (spec 002); os pontos de extensão são o `actions` do `Composer` (T037) e o mapa de componentes do `Markdown` (T034)
- Evitar: tarefas vagas, conflito de arquivo entre tarefas `[P]`, dependência entre histórias que quebre a independência
