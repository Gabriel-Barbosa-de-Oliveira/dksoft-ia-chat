# Research: Exportação de Arquivos e Gráficos no Chat

**Feature**: [spec.md](./spec.md) | **Plano**: [plan.md](./plan.md)

Fatos do repositório que ancoram as decisões (lidos em 31/10/2026):

- O modelo **não vê os registros brutos**: `shapeResultsMiddleware` corta cada resultado de tool em `TOOL_RESULT_MAX_ROWS` (40) linhas e remove CPF, e-mail e telefone dos resultados `list_*`. Um arquivo com todos os registros precisa dos dados brutos, guardados no servidor.
- O histórico do agente é só texto (`ChatTurn`: pessoa e assistente). Os resultados das tools de turnos anteriores **não voltam ao modelo**.
- O backend roda em **uma única máquina** do Fly.io (`shared-cpu-1x`, 1 GB), imagem `node:24-bookworm-slim` (glibc, sem fontes de sistema), com volume `/data` só para o SQLite.
- `web/` valida tudo com zod, tem `lib/events.ts` espelhando `api/src/domain/events.ts`, e hoje **rejeita** evento SSE desconhecido.
- Os pacotes `api/` e `web/` são separados e duplicam contratos de propósito (padrão já usado em `events.ts`).

## Decisão 1: de onde vêm os dados do arquivo

- **Decision**: o middleware que já passa por todo resultado de tool grava os registros brutos num **armazém de resultados em memória**, com identificador (`resultId`), ligado à conversa, com expiração de 1 hora (`RESULT_TTL_MS`). O resumo que o modelo recebe ganha o campo `resultId`. As tools de exportação e de gráfico recebem esse identificador (ou, se omitido, usam o resultado mais recente da conversa) e leem os registros do armazém.
- **Rationale**: atende FR-002 e FR-024 de forma estrutural: o modelo nunca digita valores e nada fica guardado além de 1 hora. Em memória, nada de dado pessoal vai a disco (princípio VI) e a limpeza é simples. A máquina é única (DEPLOY.md), então não há problema de consistência entre instâncias.
- **Alternatives considered**: (a) tabela no SQLite: guardaria CPF, e-mail e telefone em repouso, com risco de sobrar após reinício; (b) modelo repassa as linhas como argumento da tool: caro em tokens, sujeito a erro e fere FR-002; (c) refazer a consulta à API DKSOFT na hora de exportar: gasta cota (60/min, 5 simultâneas) e pode devolver dados diferentes dos exibidos.
- **Consequência aceita**: reiniciar o servidor apaga os resultados; a pessoa refaz a consulta (já é o comportamento previsto em FR-024).

## Decisão 2: como o modelo escolhe o resultado em turnos posteriores

- **Decision**: duas formas combinadas. (1) Se `resultId` for omitido, vale o resultado mais recente da conversa. (2) Uma tool `resultados_disponiveis` lista os resultados vivos da conversa (id, descrição, linhas, hora). O prompt manda informar qual resultado será usado (FR-012).
- **Rationale**: como o histórico não contém resultados de tools, "me manda isso em Excel" no turno seguinte só funciona com esse mecanismo do lado do servidor.
- **Alternatives considered**: colocar o `resultId` no texto salvo da resposta do assistente: polui o histórico e a resposta exibida; pedir ao modelo para repetir o id: frágil.

## Decisão 3: quem calcula os valores do gráfico

- **Decision**: o modelo pede o gráfico com uma **requisição de alto nível** (`resultId`, tipo, título, campo de agrupamento, medida: contagem ou soma de um campo, granularidade de data opcional). Uma função pura no servidor agrega os registros (somas em centavos inteiros, como já faz `shape-result.ts`) e produz a **especificação do gráfico** (tipo, título, categorias do eixo x, séries), validada com zod. Só essa especificação segue para o front e para os arquivos.
- **Rationale**: FR-016 pede valores exatos vindos dos registros; assim o modelo escolhe *o que* mostrar e o servidor garante os números. O contrato com o front continua sendo a especificação estruturada pedida.
- **Alternatives considered**: o modelo escreve a especificação inteira com os valores: reintroduz o risco de valor inventado ou arredondado; o front agrega os registros: exigiria enviar registros brutos (inclusive pessoais) ao navegador.

## Decisão 4: como as tools devolvem gráfico e arquivo ao stream

- **Decision**: as tools `gerar_grafico` e `exportar_arquivo` usam o formato de resposta "conteúdo + artefato" do LangChain: o texto vai ao modelo e o **artefato** (especificação ou descritor do arquivo) vai no `ToolMessage`. `agent.ts` já observa os `ToolMessage` no modo `updates`; passa a emitir `AgentEvent` do tipo `chart` e `file`, e o `ChatService` os transforma em eventos SSE.
- **Rationale**: sem canal paralelo nem estado global; os eventos nascem no mesmo fluxo ordenado dos avisos de consulta. A verificação do formato de artefato na versão instalada do `langchain` é a primeira tarefa de implementação (risco R1 do plano).
- **Alternatives considered**: callback injetado nas tools que escreve direto no stream: acopla as tools ao transporte (viola o princípio I).

## Decisão 5: bibliotecas dos arquivos

Verificado no registro do npm em 31/10/2026:

| Formato | Escolha | Versão | Última publicação | Motivo |
|---------|---------|--------|-------------------|--------|
| PDF | `pdfmake` | 0.3.13 (MIT, Node ≥ 20) | 25/10/2026 | Tabelas, quebra de página e imagens declarativas; sobre `pdfkit` 0.20.2. Exige fonte TTF embutida (acentos). |
| Word | `docx` | 9.15.1 (MIT) | 31/10/2026 | Ativa, só `fflate` como dependência; tabelas e `ImageRun` com PNG. |
| Excel | `write-excel-file` | 4.1.1 (MIT) | 08/06/2026 | Só `fflate`; células tipadas (número, data, texto), suporta imagens. |
| Gráfico → PNG | `@resvg/resvg-js` | 2.6.2 (MPL-2.0) | 28/01/2026 | Binário pré-compilado (sem libs de sistema); lê SVG e carrega fontes por arquivo. |

- **Excel — por que não `exceljs`**: a última publicação foi em 20/12/2024 (4.4.0) e traz dependências antigas (`archiver` 5, `unzipper` 0.10, `uuid` 8). Para um serviço com dados financeiros, preferi a opção ativa e enxuta.
- **Gráfico nativo no Excel**: nenhuma das bibliotecas avaliadas cria gráfico nativo. O gráfico entra nos três formatos como **imagem PNG** ao lado da tabela, o que atende FR-021 ("o gráfico junto da tabela de dados, com os mesmos valores"). Gráfico editável no Excel fica como evolução.
- **Alternatives considered**: HTML → PDF com Playwright/Puppeteer: layout excelente, mas navegador de ~300 MB na imagem e 1 GB de RAM na máquina; `pdfkit` direto: tabelas manuais; `sharp`: depende de fontes de sistema; `chartjs-node-canvas`: exige `canvas` nativo.
- **Pendência de verificação (tarefa)**: confirmar na implementação o posicionamento de imagem do `write-excel-file` e a licença MPL-2.0 do `resvg` (uso como dependência, sem modificar o código dela, é compatível; registrar no plano).

## Decisão 6: fonte dos gráficos e dos PDFs

- **Decision**: embarcar no repositório `api/assets/fonts/` os arquivos TTF do **Archivo** (Regular e SemiBold, licença OFL) e usá-los no `pdfmake` e no `resvg` (`fontFiles`, `loadSystemFonts: false`).
- **Rationale**: a imagem Docker não tem fontes de sistema; sem isso o texto do gráfico some e os acentos quebram. Archivo é a fonte do design system, então PDF e gráfico ficam coerentes com a interface. O pacote `@fontsource/archivo` do front só traz WOFF/WOFF2, que o `resvg` não lê.
- **Pendência (tarefa)**: baixar os TTF de uma fonte oficial (repositório do Google Fonts) e registrar a licença OFL em `api/assets/fonts/OFL.txt`.

## Decisão 7: gráfico no navegador

- **Decision**: componentes **SVG próprios** em React, com a geometria (escalas, marcações "bonitas" do eixo, caminhos de linha, fatias da pizza, desbaste de rótulos) em funções puras em `web/src/lib/`, testadas com `node:test`. Sem biblioteca de gráficos.
- **Rationale**: o design system é restrito (acento único, raio zero, régua de 2px), as exigências de acessibilidade são específicas (resumo em texto, tabela de dados, séries distinguíveis sem cor) e são apenas três tipos de gráfico. Uma biblioteca traria peso no bundle, estilo difícil de alinhar ao Modernist e controle limitado de acessibilidade. Evita também mexer na stack do front. A constitution pede lógica em `lib/` pura e componentes finos, que é exatamente este desenho.
- **Alternatives considered**: Recharts/ECharts/Chart.js: rápidos de começar, mas pesados e menos controláveis; reaproveitar o SVG do servidor: não daria tooltip, tema claro/escuro nem tabela acessível.
- **Duplicação aceita**: a geometria do servidor (SVG estático para PNG) e a do front são implementações separadas e pequenas, ambas cobertas por testes contra os mesmos exemplos de especificação. É o mesmo padrão de espelhamento de contratos já usado entre `api/` e `web/`.

## Decisão 8: paleta e distinção de séries

- **Decision**: no máximo **6 séries** e **24 categorias** por gráfico (pizza: até **8 fatias**, o restante agrupado em "Outros"). Séries se distinguem por **três canais**: cor (acento e rampas neutras do design system, com variantes por tema), **forma** (marcadores círculo, quadrado, triângulo etc. nas linhas; padrões de hachura nas barras e fatias) e **rótulo direto/legenda**. Acento vermelho só na primeira série, mantendo a regra do design system.
- **Rationale**: FR-017/018 e a regra "nunca só cor". O limite evita gráficos ilegíveis; o agrupamento "Outros" mantém a soma correta.
- **Pendência (tarefa)**: validar contraste mínimo (3:1 para elementos gráficos, 4,5:1 para texto) nos dois temas com o utilitário `lib/contrast.ts` que o front já tem.

## Decisão 9: entrega do arquivo e vínculo à sessão

- **Decision**: o arquivo vive **em memória** (`Buffer`) por 30 minutos (`EXPORT_TTL_MS`), com teto de bytes no total. O download é `GET /conversations/:conversationId/exports/:fileId`, que exige `Authorization: Bearer <chave>` como todas as rotas. O front baixa o arquivo com `fetch` (enviando o cabeçalho) e dispara o salvamento por `Blob`. O identificador do arquivo é um UUID aleatório; arquivo de outra conversa, desconhecido ou vencido responde `404` (a interface usa o `expiresAt` do cartão para dizer "expirou" em vez de "não encontrado", sem o servidor guardar ids vencidos).
- **Rationale**: um `<a href>` simples não envia cabeçalho, mas colocar chave ou assinatura na URL a deixaria em histórico de navegador e logs de proxy. Com `fetch` + `Blob` o link é inútil sem a chave (FR-004, SC-003) e nenhum segredo trafega na URL. O volume `/data` não é usado para arquivos: dado pessoal não deve ficar em disco (princípio VI).
- **Alternatives considered**: URL assinada com HMAC (permite `<a href>` direto, mas o link copiado funciona sem a chave durante o prazo); S3/R2 (nova infraestrutura e segredo, desnecessários com máquina única).

## Decisão 10: geração fora do laço de eventos

- **Decision**: a montagem de PDF, Word, Excel e PNG roda em um **worker thread** (`node:worker_threads`, módulo nativo do Node), com tempo máximo (`EXPORT_TIMEOUT_MS`, padrão 30 s) e no máximo 2 gerações simultâneas. Se estourar o tempo, o worker é encerrado e a pessoa vê o erro com código de suporte.
- **Rationale**: a máquina tem 1 vCPU compartilhada e atende SSE de outras pessoas; gerar 5.000 linhas num PDF no laço principal congelaria os streams. O limite de 5.000 linhas (FR-005) fica sujeito à medição na tarefa de desempenho (risco R3).
- **Alternatives considered**: gerar no laço principal (mais simples, pior para os outros usuários); processo filho (mais pesado que um worker).

## Decisão 11: dados pessoais nos arquivos (FR-008)

- **Decision**: o arquivo sai **mascarado por padrão**, reaproveitando `maskPii` e uma lista de colunas sensíveis (CPF, e-mail, telefone, celular, telefone de contato), além de passar `maskPii` em campos de texto livre como `historico`. Os dados completos só saem se **o texto da última mensagem da pessoa** pedir isso de forma explícita, verificado por uma função pura do servidor (`asksForFullPersonalData`), e não apenas porque o modelo marcou a opção. O botão "Exportar" nunca inclui dados completos.
- **Rationale**: a constitution (princípio VI) quer barreiras estruturais, não dependentes do julgamento do modelo. Falso negativo (pedido ambíguo) resulta em arquivo mascarado, que é o lado seguro; a pessoa pode repetir o pedido de forma mais clara.
- **Alternatives considered**: confiar no argumento booleano do modelo (fere o princípio VI); pedir confirmação por botão (mais seguro, porém outra interação; pode virar evolução).

## Decisão 12: persistência dos gráficos no histórico

- **Decision**: nova coluna opcional `artifacts` (JSON) na tabela `messages`, preenchida na resposta do assistente com a lista de especificações de gráfico. `GET /conversations/:id/messages` passa a devolver `charts` por mensagem (campo novo e opcional, compatível com quem não o conhece). A migração é idempotente (`PRAGMA table_info` + `ALTER TABLE ... ADD COLUMN`). Cartões de arquivo **não** são persistidos (expiram).
- **Rationale**: FR-019 pede que o gráfico reapareça ao reabrir a conversa; a especificação é pequena (≤ 6×24 números) e não contém dado pessoal além do que o próprio gráfico mostra.
- **Atenção**: gráficos de agrupamento por aluno poderiam expor nomes no rótulo do eixo. Regra: agrupar por campos de pessoa (nome do aluno, responsável) só com no máximo as categorias do limite e sem CPF, e-mail ou telefone como rótulo (validado na função de agregação).

## Decisão 13: novos eventos SSE e compatibilidade entre deploys

- **Decision**: três eventos novos e aditivos: `result` (um resultado ficou disponível para exportar), `chart` (especificação de gráfico) e `file` (arquivo pronto). O front passa a **ignorar eventos desconhecidos** (hoje rejeita), o que vira a **primeira tarefa** do front. Ordem de deploy: front tolerante primeiro (Vercel), depois a API (Fly).
- **Rationale**: API (Fly) e front (Vercel) são publicados separadamente; sem essa tolerância, uma API nova quebraria um front antigo durante a janela entre os deploys. FR-026 exige que nada mude para quem não usa as novas capacidades.

## Decisão 14: exportação pelo botão sem passar pelo modelo

- **Decision**: `POST /exports` recebe `conversationId`, `resultId`, `format` e `chartId` opcional, e chama o **mesmo serviço** usado pela tool `exportar_arquivo`, sempre com máscara ativa. Sem chamada ao modelo, sem custo de tokens.
- **Rationale**: FR-010 e US3; o serviço único garante que o arquivo do botão e o do pedido escrito tenham o mesmo conteúdo (cenário 4 da US3).

## Decisão 15: registro de funcionamento (FR-023)

- **Decision**: nova tabela `export_runs` (identificador de requisição, conversa, tipo `export` ou `chart`, formato ou tipo de gráfico, quantidade de linhas, duração, resultado, `explicit_pii` 0/1, momento). Sem conteúdo, sem nome de arquivo, sem endereço de link; erros passam por `maskPii` como nos demais logs.
- **Rationale**: SC-007 e coerência com a tabela `runs` já existente.

## Riscos abertos (viram tarefas de verificação)

| ID | Risco | Tratamento |
|----|-------|-----------|
| R1 | Formato "conteúdo + artefato" das tools pode se comportar diferente com o `createAgent` e com o middleware `ShapeResults` | Primeira tarefa do backend: teste mínimo de ida e volta do artefato; plano B é um registro por execução (`RunTracker`) lido pelo `agent.ts` ao fim de cada tool |
| R2 | Worker thread com TypeScript via `tsx` e com binário do `resvg` na imagem Docker | Teste de fumaça dentro do `Dockerfile` antes do deploy; plano B é gerar no processo principal com limite de linhas menor |
| R3 | 5.000 linhas em PDF/Word pode estourar 30 s numa vCPU compartilhada | Medir na tarefa de desempenho; se necessário, limite por formato (ex.: PDF 2.000) em configuração, sem nova spec |
| R4 | Memória: resultados (1 h) e arquivos (30 min) em 1 GB | Tetos de linhas por resultado (20.000), bytes totais por armazém e remoção do mais antigo; medir no quickstart |
| R5 | Falso negativo do pedido explícito de dados completos | Lado seguro (mascarado); frases aceitas documentadas e testadas em `asksForFullPersonalData` |
