# Research: Interface Web do Chat

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Decisões da Fase 0. Versões conferidas no registro do npm em 2026-10-30. Os números de contraste foram calculados com a fórmula de luminância relativa do WCAG 2.1 sobre os tokens do `styles.css` do design system (script reproduzível descrito no item 9).

## 1. Stack e versões

- **Decisão**: Vite ^8.3 + React ^19.3 + TypeScript `strict` em um pacote `web/` separado, como já fixa a constitution (seção "Frontend"). Dependências de runtime: `react`, `react-dom`, `react-router` ^8.5, `zod` ^3.25.76, `react-markdown` ^10.1, `remark-gfm` ^4.0, `lucide-react` ^1.65, `@fontsource/archivo` ^5.3. Dev: `vite`, `@vitejs/plugin-react` ^6.1, `typescript` ^5.9.3, `tsx` ^4.23, `@types/node` ^24, `@types/react`, `@types/react-dom`, `oxlint`, `playwright` ^1.64, `@axe-core/playwright` ^4.14.
- **Justificativa**: nenhuma mudança na constitution. `zod` e `typescript` ficam na mesma versão maior do `api/` (3.25 e 5.9) para os dois pacotes falarem o mesmo dialeto de schema. `react-router` 8.5 exige Node ≥ 22.22 e React ≥ 19.2.7, compatível com o Node 24 do projeto. `@vitejs/plugin-react` 6 exige Vite 8.
- **Alternativas**: Angular 22 foi avaliado a pedido e descartado por decisão do dono do projeto (a constitution e a spec ficam como estão). TypeScript 7.0 (lançado) não foi adotado para manter o par `api/` e `web/` na mesma versão; a troca é uma decisão separada. Zod 4 idem.

## 2. Consumo do stream: `fetch` + `ReadableStream` com decodificador SSE puro

- **Decisão**: `POST /chat` com `fetch` (cabeçalhos `Authorization`, `Content-Type: application/json`, `Accept: text/event-stream`) e `AbortController`. O corpo é lido com `response.body.getReader()` e `TextDecoder` em modo `stream: true`. Um decodificador **puro** (`SseDecoder`, em `lib/sse.ts`) recebe pedaços de texto e devolve quadros `{ event, data }` completos, tratando quadros partidos entre pedaços, `\r\n`, linhas `data:` e comentários. Cada quadro passa por `StreamEventSchema` (zod) antes de virar estado.
- **Fim sem sinal terminal**: se o leitor termina sem `done` nem `error`, o resultado é o erro de cliente `connection_lost` (FR-019). Há também um prazo total de **150 s** por pergunta no cliente (tempo máximo do backend é 120 s mais margem); passado o prazo, o cliente aborta e mostra `client_timeout`. Sem heartbeat no contrato, não se usa limite de silêncio entre eventos, porque uma consulta longa é legítima.
- **Interromper**: "Parar" chama `abort()`; o texto parcial fica marcado como interrompido. O backend registra `aborted` e não grava o par (contrato 001), portanto uma pergunta interrompida não aparece no histórico ao recarregar. A interface avisa isso no próprio turno interrompido.
- **Justificativa**: `EventSource` é só GET e não envia cabeçalhos (já registrado na spec 001, research item 4). O decodificador puro é testável sem rede e sem DOM.
- **Alternativas**: biblioteca de SSE para POST (dependência a mais para ~60 linhas de lógica testável); WebSocket (exigiria mudar o contrato).

## 3. Estado do turno: reducer puro

- **Decisão**: o turno de pergunta/resposta é uma máquina de estados num reducer puro (`lib/chat-reducer.ts`), alimentado por ações (`SEND`, `META`, `TOOL_START`, `TOOL_END`, `TOKEN`, `DONE`, `ERROR`, `ABORT`, `RESET`, `LOAD_HISTORY`). Estados do turno: `pending → working → streaming → done | error | interrupted`, com o sinalizador `partial` vindo do `done`. Os componentes só leem o estado.
- **Tokens em lote**: os `token` são acumulados num buffer e descarregados no máximo uma vez por quadro de animação (`requestAnimationFrame`), para não re-renderizar o Markdown a cada pedaço. A função de junção do buffer é pura.
- **Justificativa**: regra de ouro da constitution (funções puras, componentes finos) e o único jeito de testar com `node:test` todos os caminhos do FR-005 a FR-019 sem navegador.
- **Alternativas**: biblioteca de estado (Zustand/Redux): peso desnecessário para um fluxo com um turno ativo por vez.

## 4. Rotas e URL

- **Decisão**: duas rotas, `/` (conversa nova, estado vazio) e `/c/:conversationId`. Um id que não seja UUID válido (função pura `isUuid`) vai direto ao estado "conversa não encontrada" sem chamar a API; um UUID inexistente recebe `404 conversation_not_found` e mostra o mesmo estado. Ao chegar o evento `meta` de uma conversa nova, a URL passa para `/c/:id` com `replace`, para o botão "voltar" não reabrir o vazio. Hospedagem estática precisa de fallback para `index.html` (o `vite preview` já faz).
- **Justificativa**: FR-013 e SC-007. `X-Conversation-Id` também vem no cabeçalho, mas o `meta` basta e é o primeiro evento.
- **Alternativas**: `?c=<id>` (menos legível, mesmo custo); rota própria para o histórico (o histórico é um painel, não uma página).

## 5. Chave de acesso

- **Decisão**: a chave fica em `sessionStorage` (sai ao fechar a aba), atrás de um módulo `storage/access-key.ts` com `try/catch` e **fallback em memória** quando o armazenamento estiver bloqueado (com aviso discreto, edge case da spec). A validação ocorre na tela de acesso com `GET /conversations?limit=1`: é autenticada, barata e não aciona modelo nem API DKSOFT; `GET /health` não serve porque é público. `200` guarda a chave; `401` mostra "chave incorreta" junto ao campo; `403` e erros de rede viram as mensagens do item 13. O campo é `type="password"`, `autocomplete="off"`, e a chave não é lida de volta para a tela. Nunca vai à URL, a log, a variável `VITE_*` nem a mensagem de erro. Um `401` em qualquer chamada posterior limpa a chave e volta à tela de acesso, sem perder o rascunho (que vive em memória, acima do portão de acesso).
- **Justificativa**: FR-001, FR-002, FR-018, SC-006. Variáveis `VITE_*` são embutidas no bundle público e jamais podem conter segredo.
- **Alternativas**: `localStorage` (a spec pede só durante a sessão do navegador); cookie `HttpOnly` (exigiria mudar o backend).

## 6. Histórico: paginação e prévia

- **Decisão**: `GET /conversations?limit=20&offset=n`. A resposta não traz total, então "Carregar mais" aparece enquanto a última página vier cheia (20 itens) e some quando vier mais curta. A **prévia** (trecho da primeira pergunta) é obtida sem mudar o contrato: uma fila com concorrência 2 chama `GET /conversations/:id/messages` para cada item visível, guarda só o trecho em um cache **em memória** (nunca em storage) e mostra data e hora enquanto a prévia não chega ou se ela falhar. O trecho é cortado em 60 caracteres por função pura.
- **Justificativa**: resolve a premissa da spec ("quando viável sem mudar o contrato"). O limite de 30 requisições por minuto vale só em `POST /chat`, então a leitura é livre.
- **Custo conhecido**: carrega o histórico inteiro de cada conversa só para ler a primeira linha (N+1). Aceitável no MVP, com 20 itens por página. A solução limpa é um campo `preview` em `/conversations`, que fica registrado como sugestão para uma spec do backend; o front já isola a lógica em `lib/conversation-label.ts` e `hooks/useConversationPreview.ts` para essa troca ser pequena.

## 7. Renderização do texto do assistente

- **Decisão**: `react-markdown` 10 com `remark-gfm` (tabelas, listas, tachado), **sem** `rehype-raw`: HTML bruto vindo do texto é exibido como texto, nunca interpretado. Sobrescritas de componentes: `a` com `target="_blank"` e `rel="noopener noreferrer"`; `table` envolta em um bloco rolável horizontalmente com `tabIndex={0}`, `role="region"` e nome acessível (FR-023); `code` e `pre` com quebra controlada. O `urlTransform` padrão já descarta `javascript:`.
- **Justificativa**: FR-008, SC-011. O prompt do backend não pede Markdown, mas os modelos o produzem com frequência para listas e tabelas; renderizar com segurança evita escapes visíveis.
- **Risco**: durante o streaming o Markdown chega incompleto (cerca de código ou tabela abertas). Aceito, pois o texto se acerta ao concluir; o buffer em lote reduz o "piscar".
- **Alternativas**: `marked` + `dompurify` (duas peças a manter em vez de uma e injeção via `dangerouslySetInnerHTML`, o que se quer evitar).

## 8. Design system: cópia vendorizada mais camada de tokens

- **Decisão**: o `styles.css` do Modernist entra em `web/src/styles/modernist.css` **sem alteração, exceto uma**: remover a linha `@import` do Google Fonts e carregar Archivo 400/600/800 por `@fontsource/archivo` (autohospedada, sem pedido a terceiros, compatível com CSP estrita). Tudo que o projeto precisa e o DS não tem vai em arquivos próprios, carregados depois: `app-tokens.css` (tema escuro, escala ampliada, alvos de toque, correções de contraste) e `app.css` (layout do app). A cópia vendorizada é tratada como somente leitura; ressincronizar com o DS é recopiar o arquivo e reaplicar a única remoção.
- **Justificativa**: o readme do DS manda consumir tokens e classes sem recriar paralelos; a fonte da verdade do DS continua no projeto "Dksoft MCP", e a camada própria evita divergir dela.
- **Alternativas**: editar o `styles.css` vendorizado (perde a sincronia); publicar o DS como pacote (fora de escopo).

## 9. Achados de acessibilidade do DS (contraste calculado)

O DS no estado em que está **não atinge WCAG 2.1 AA** no tema claro. Cálculo sobre os tokens do `styles.css` (`bg` #f3f2f2, `surface` #eae9e9, `text` #201e1d, `accent` #ec3013), com `color-mix(... X%, transparent)` composto sobre o fundo:

| Elemento do DS | Razão | Mínimo | Resultado |
|----------------|-------|--------|-----------|
| Rótulo do `.btn-primary` (fundo sobre acento) | 3,76 | 4,5 | Reprova |
| `.btn-primary:hover` (acento-600) | 4,25 | 4,5 | Reprova |
| `.btn-ghost` e links em acento, 14 px | 3,76 | 4,5 | Reprova |
| Segmento ativo `.seg-opt` | 3,76 | 4,5 | Reprova |
| Borda de `.input` e `.btn-secondary` (divisor 40 %) | 2,41 | 3 | Reprova |
| Texto "muted" a 50/55/60 % (`.card-meta`, `figcaption`, `.table th`) | 3,16 / 3,65 / 4,24 | 4,5 | Reprova |
| Texto a 70 % (`.field > label`) | 5,81 | 4,5 | Passa |
| Texto principal sobre fundo e surface | 14,86 / 13,70 | 4,5 | Passa |
| Acento sobre fundo (ícone, foco, texto grande) | 3,76 | 3 | Passa |
| Acento-700 sobre fundo (texto de parágrafo em acento) | 6,41 | 4,5 | Passa |

**Correções por tokens, só com degraus das rampas do DS** (mantém o SC-012, "nada fora dos tokens do sistema"):

- Preenchimento e texto de ação: `--color-action` = acento-700 (#ae1800), com rótulo claro (6,41 : 1); hover acento-800, pressionado acento-900. O acento puro #ec3013 continua nos usos que só exigem 3 : 1 (anel de foco, régua, ícone, marca).
- Borda de controles: `--color-border-control` = neutro-600 #7d7979 (3,85 sobre fundo, 3,55 sobre surface). Os divisores de 2 px entre seções continuam em `--color-divider`: são estruturais, não identificam componente.
- Texto secundário: `--color-text-muted` = neutro-700 #605d5d (5,83 sobre fundo, 5,38 sobre surface).

Para reproduzir: o cálculo é a fórmula de luminância relativa do WCAG com a composição `p·X + (1−p)·fundo` do `color-mix`; o plano exige que uma verificação equivalente rode no teste de tokens (item 17), de modo que um token que regrida de contraste quebre o build.

## 10. Tema escuro

- **Decisão**: derivado das rampas do DS, sem hex novo. Fundo `--color-bg` = tinta do DS (#201e1d), `--color-surface` = neutro-900 (#2d2b2b), texto = fundo claro do DS (#f3f2f2), nem preto nem branco puros; elevação por clareamento de superfície (neutro-800 #444141 para o degrau seguinte), sem sombra. Acento de preenchimento = acento-500 (#ff563c) com rótulo escuro (5,26 : 1); texto e ícone em acento = acento-400 (#ff9783: 7,91 sobre fundo, 6,71 sobre surface). Muted = neutro-400 (#bab6b6: 8,27 / 7,01). Borda de controle = texto a 60 % (5,56 sobre surface; ≥ 3). Foco: acento-500 (5,26).
- **Mecanismo**: `data-theme="light|dark"` no `<html>`. Sem escolha manual vale `prefers-color-scheme` por CSS puro (`@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` mais `:root[data-theme="dark"] { … }`). A preferência (`system | light | dark`) fica em `localStorage` (chave `dksoft.theme`, não sensível). Um script **externo** pequeno (`public/theme-init.js`) aplica `data-theme` antes da primeira pintura para evitar clarão; por ser arquivo, dispensa `unsafe-inline` na CSP. `lib/theme.ts` resolve a preferência (pura).
- **Justificativa**: FR-021; `design.instructions.md` (sem `#000`/`#fff`, elevação por clareamento).

## 11. Escala de espaçamento

- **Decisão**: o DS define `--space-1` a `--space-4`, `--space-6`, `--space-8` (4, 8, 12, 16, 24, 32 px). As diretrizes do repositório fixam a escala `4, 8, 12, 16, 24, 32, 48, 64`. O plano acrescenta `--space-12` (48 px) e `--space-16` (64 px) em `app-tokens.css`, nomeados como o DS (`--space-N` = N × 4 px). Os dois valores já constam da escala das diretrizes, então não é um valor mágico novo; fica marcado para revisão humana, como as diretrizes pedem antes de ampliar a escala.
- **Regra aplicada**: nenhum `px`/hex literal em componente (oxlint, item 19) e nenhum valor fora de `var(--space-*)` em CSS próprio (teste de tokens, item 17). `gap` em vez de margens em filhos.

## 12. Alvos de toque de 44 px

- **Decisão**: `--target-min: calc(var(--space-12) - var(--space-1))`, equivalente a 44 px, aplicado por sobrescrita a `.btn`, `.btn-icon`, `.input`, `.seg-opt` e links da navegação. O DS usa 36 px em `.btn-icon` e `.input`. Alvos pequenos dentro de texto (links no Markdown) ficam fora da regra de 44 px por serem em linha, mas ganham espaçamento e foco visível.
- **Justificativa**: FR-022 e SC-010.

## 13. Erros e avisos sem depender de cor

- **Decisão**: o DS só tem um tom de alerta: o acento vermelho, que é também a cor da marca. Erro e aviso usam **forma + ícone + rótulo + texto**: moldura de 2 px em `--color-text` (tinta), ícone Lucide (`circle-alert` para erro, `triangle-alert` para aviso/parcial, `octagon-x` para interrompido) e rótulo textual ("Erro", "Aviso", "Interrompida"). A cor entra só como reforço no ícone (acento-700 no claro, acento-400 no escuro). Há um componente único `StatusNotice` com as três variantes.
- **Mapeamento de erros** (tabela completa em [contracts/ui.md](./contracts/ui.md) e [data-model.md](./data-model.md)): cada `error` HTTP e cada `code` do stream vira `{ título, mensagem, ação, código de suporte? }` por função pura `toUserError`, em pt-BR e sem texto cru da API (FR-015, FR-016).

## 14. Acessibilidade dinâmica e foco

- **Decisão**: uma região `aria-live="polite"` visualmente oculta recebe anúncios curtos e únicos: nome da consulta em andamento ("Buscando o aluno pela matrícula…"), "Resposta concluída", "Resposta interrompida", mensagens de erro (`role="alert"` só para erro). O texto da resposta **não** fica em região viva, e o contêiner do turno usa `aria-busy="true"` enquanto chega, evitando reler a cada token (US4, cenário 4). Modais usam `<dialog>` nativo com `showModal()` (foco preso, `Esc`, retorno de foco). Há link "Pular para a conversa", um único `h1` por tela, `main`/`nav`/`aside` como pontos de referência e `:focus-visible` do DS. `prefers-reduced-motion` desliga o giro do ícone de carregamento e qualquer transição.
- **Justificativa**: FR-022, SC-008, SC-009.

## 15. Rolagem durante o streaming

- **Decisão**: a função pura `shouldFollow({ scrollTop, clientHeight, scrollHeight }, tolerance)` decide se a lista acompanha o fim (tolerância de 48 px, a mesma da escala). Se a pessoa rolou para cima, a lista não se move e aparece "Ir para o fim" (`arrow-down`). Enviar uma pergunta sempre leva ao fim.
- **Justificativa**: FR-006 e US1, cenário 6.

## 16. Layout responsivo (grade modular do Modernist)

- **Decisão**: largura mínima de 20 rem (320 px). Em ≥ 64 rem, grade de duas colunas, histórico à esquerda (largura de 20 rem a 24 rem) e conversa à direita, separados por régua de 2 px. Abaixo de 64 rem, o histórico vira uma folha (`<dialog>`) aberta por um botão "Histórico" na barra, sem cobrir o campo de pergunta em digitação. Estrutura da conversa: barra `.nav` (marca, tema, sair), lista de turnos separados por régua de 2 px, compositor fixado ao pé com régua superior. Rótulos "Você" e "Assistente" alinhados à esquerda no estilo `h6` do DS; sem balões, sem cantos arredondados. Consultas de mídia usam `rem` (a variável CSS não vale em `@media`); a lista de pontos de quebra mora em um só arquivo.
- **Justificativa**: FR-023, FR-024, SC-010.

## 17. Estratégia de testes

- **Unidade (`node:test` via `tsx`, ao lado do código)**: tudo em `src/lib/` (SSE, schemas, reducer, erros, validação, tema, prévia, rolagem, UUID, contagem regressiva, junção de tokens) e os clientes `src/api/` com `fetch` injetado e `Response`/`ReadableStream` falsos (Node 24 já os tem).
- **Teste de tokens (guard)**: lê os `.css` do projeto (menos `modernist.css`) e reprova hex literal, `px` fora dos arquivos de token, `font-family` fora de `var(--font-*)` e pares de cor com contraste abaixo do mínimo (usa a mesma função pura de contraste de `lib/contrast.ts`). Cobre SC-012 e protege o item 9.
- **E2E de interface (`node:test` com a biblioteca `playwright`)**: sobe o `vite preview` e um servidor falso de contrato 001 (`node:http`, roteirizável) em `localhost`, sem rede externa. Percorre cada história (US1 a US4), os dois temas e as larguras 320/768/1280, e roda `@axe-core/playwright` em cada tela e estado (SC-008, SC-009, SC-010). Usar a biblioteca dentro do `node:test`, e não o executor próprio do Playwright, mantém a constitution ("testes com `node:test`").
- **Portões**: `npm --prefix web run typecheck`, `lint`, `test`, `build` e `test:e2e` (este último exige navegadores do Playwright instalados).

## 18. Estrutura e camadas

- **Decisão**: `web/` independente (sem workspaces). Mapeamento das camadas da constitution para o front, com dependências em um só sentido: `components` → `hooks` → (`api`, `storage`) → `lib`. `lib/` é o domínio: puro, sem React, sem `fetch`, sem DOM, sem `Date.now()` (o relógio entra por parâmetro). `api/` e `storage/` fazem IO e são a camada "model/service". `hooks/` é o "controller" (liga IO e estado ao reducer). `components/` e `pages/` são a "view", finos. Árvore em [plan.md](./plan.md).
- **Justificativa**: princípios I e IV da constitution adaptados ao front, sem inventar camadas.

## 19. Lint e aderência ao DS

- **Decisão**: `oxlint` com a configuração `_adherence.oxlintrc.json` do projeto do DS (plugins `react` e `import`; regras que proíbem hex literal, `Npx` literal e família de fonte fora de Archivo em literais de código). Isso cobre o TypeScript e o JSX; o CSS é coberto pelo teste de tokens (item 17).

## 20. Gráficos e voz: fora desta spec

- **Decisão**: nenhuma dependência de gráficos ou de áudio entra. Os pontos de extensão ficam prontos e custam pouco: o compositor expõe um `slot` de ações (onde entraria o controle de voz) e o componente `Markdown` aceita um mapa de componentes (onde entraria um bloco de gráfico). Gráficos dependem de dado estruturado que o contrato da 001 não entrega, e voz depende de decisão de transcrição (no navegador ou no servidor, esta última via endpoint de transcrição do OpenRouter); ambos pedem spec própria, como a 001 já separou.

## 21. Segurança do front

- Sem HTML bruto do texto (item 7); links externos com `noopener noreferrer`; `Referrer-Policy: no-referrer` recomendada na hospedagem.
- CSP recomendada para a hospedagem estática: `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' <origem da API>; base-uri 'none'; frame-ancestors 'none'`. Como tema e fontes são arquivos próprios, não é preciso `unsafe-inline`.
- Nada de conversa vai a `localStorage`/`sessionStorage`/IndexedDB (FR-025); só chave (sessão), tema e, em memória, rascunho e cache de prévia.
- `VITE_API_BASE_URL` (padrão `http://localhost:3000`) é a única variável do front e não é segredo. A origem do front precisa constar em `CHAT_CORS_ORIGINS` no backend (o padrão do `.env.example` já inclui `http://localhost:5173`).

## Riscos e mitigações

| # | Risco | Mitigação |
|---|-------|-----------|
| R1 | Os schemas do front divergem dos eventos do `api/` | Fixtures tiradas de `specs/001-agent-api/contracts/http.md` nos testes; falha de schema vira `internal_error` visível, nunca silêncio |
| R2 | Prévia N+1 pesa em históricos longos | Fila com concorrência 2, cache em memória, só itens visíveis; sugestão de campo `preview` no backend |
| R3 | Re-renderização do Markdown a cada token | Junção por quadro de animação; `React.memo` por turno concluído |
| R4 | Navegadores do Playwright não baixam em ambiente restrito | `test:e2e` separado dos portões obrigatórios de unidade; falha de instalação não bloqueia `test`/`typecheck` |
| R5 | A cópia do DS fica defasada | Uma única alteração documentada; recopiar e reaplicar; o teste de tokens acusa quebra |
| R6 | `navigator.clipboard` exige contexto seguro | `localhost` e HTTPS bastam; se indisponível, o botão "Copiar" é ocultado em vez de falhar |
| R7 | Pergunta interrompida não consta no histórico | O turno interrompido informa isso; é contrato da 001 (par só gravado em `done`) |
| R8 | Armazenamento bloqueado no navegador | Fallback em memória e aviso discreto (edge case da spec) |
| R9 | Sandbox de desenvolvimento em Node 22 e projeto em Node 24 | `engines` `>=22.22`; CI e quickstart usam Node 24 |
